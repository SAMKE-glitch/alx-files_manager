/* eslint-disable */
import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';


class Authorization {
  static async getConnect(req, res) {
    const authToken = req.header('Authorization') || null;
    if (!authToken) {
      res.status(401).send({ error: 'Unauthorized' });
      return;
    }

    // Decode authToken from base64 to utf8 to get email and password
    const authTokenDecoded = Buffer.from(authToken.split(' ')[1],
      'base64').toString('utf8');
    const [email, password] = authTokenDecoded.split(':');
    if (!email || !password) {
      res.status(401).send({ error: 'Unauthorized' });
      return;
    }
    // check if user exists
    const hash = createHash('sha1').update(password).digest('hex');
    const collection = dbClient.db.collection('users');
    const user = await collection.findOne({
      email,
      password: hash,
    });
    if (user) {
      // generate new token
      const token = uuidv4();
      const key = `auth_${token}`;
      await redisClient.set(key, user._id.toString(), 86400); // 1 day
      res.status(200).send({
        token,
      });
    } else {
      res.status(401).send({
        error: 'Unauthorized',
      });
    }
  }

  static async getDisconnect(req, res) {
    let authToken = req.header('X-Token') || null;
    if (!authToken) {
      res.status(401).send({ error: 'Unauthorized' });
      return;
    }
    authToken = `auth_${authToken}`;
    const user = await redisClient.get(authToken);
    if (user) {
      await redisClient.del(authToken);
      res.status(204).send();
    } else {
      res.status(401).send({
        error: 'Unauthorized',
      });
    }
  }
}

export default Authorization;