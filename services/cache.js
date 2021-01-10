const mongoose = require('mongoose');
const redis = require('redis');
const {promisify} = require('util');
const redisClient = redis.createClient('redus://127.0.0.1:6379');

redisClient.hget = promisify(redisClient.hget);
redisClient.hset = promisify(redisClient.hset);

const exec = mongoose.Query.prototype.exec;

mongoose.Query.prototype.cache = function (options = {}) {
	this.useCache = true;
	this.hashKey = JSON.stringify(options.key || '');
	return this;
};

mongoose.Query.prototype.exec = async function () {
	if (this.useCache) {
		const key = JSON.stringify(
			Object.assign({}, this.getFilter(), {
				collection: this.mongooseCollection.name,
			})
		);

		const cacheValue = await redisClient.hget(key);

		const doc = JSON.parse(cacheValue);

		const cacheResult = Array.isArray(doc)
			? doc.map((singleDoc) => new this.model(singleDoc))
			: new this.model(doc);

		console.log(cacheResult);
		const result = await exec.apply(this, arguments);

		redisClient.hset(key, JSON.stringify(result), 'EX', 1000);
		return result;
	}
	const result = await exec.apply(this, arguments);
	return result;
};

module.exports = {
	clearHash(hashKey) {
		redisClient.del(JSON.stringify(hashKey));
	},
};
