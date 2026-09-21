const { Client } = require('@elastic/elasticsearch');
const { config } = require('.');
const logger = require('./logger');

const esClient = new Client({ node: config.ELASTICSEARCH_URL });

const HUB_INDEX = config.ELASTICSEARCH_HUB_INDEX;
const VEHICLE_INDEX = config.ELASTICSEARCH_VEHICLE_INDEX;

const autocompleteAnalysis = {
     analyzer: {
          autocomplete_analyzer: {
               type: 'custom',
               tokenizer: 'autocomplete_tokenizer',
               filter: ['lowercase'],
          },
          search_analyzer: {
               type: 'custom',
               tokenizer: 'standard',
               filter: ['lowercase'],
          },
     },
     tokenizer: {
          autocomplete_tokenizer: {
               type: 'edge_ngram',
               min_gram: 2,
               max_gram: 20,
               token_chars: ['letter', 'digit'],
          },
     },
};

const autocompleteText = {
     type: 'text',
     analyzer: 'autocomplete_analyzer',
     search_analyzer: 'search_analyzer',
};

const initIndices = async () => {
     const hubExists = await esClient.indices.exists({ index: HUB_INDEX });
     if (!hubExists) {
          await esClient.indices.create({
               index: HUB_INDEX,
               settings: { analysis: autocompleteAnalysis },
               mappings: {
                    properties: {
                         hubId: { type: 'keyword' },
                         name: autocompleteText,
                         code: { type: 'keyword' },
                         city: autocompleteText,
                         state: { type: 'text' },
                         latitude: { type: 'float' },
                         longitude: { type: 'float' },
                         suggest: { type: 'completion' },
                    },
               },
          });
          logger.info('CargoFlow hub index created');
     }

     const vehicleExists = await esClient.indices.exists({ index: VEHICLE_INDEX });
     if (!vehicleExists) {
          await esClient.indices.create({
               index: VEHICLE_INDEX,
               mappings: {
                    properties: {
                         vehicleId: { type: 'keyword' },
                         vehicleNumber: { type: 'keyword' },
                         vehicleName: { type: 'text' },
                         vehicleType: { type: 'keyword' },
                         route: {
                              type: 'nested',
                              properties: {
                                   hubId: { type: 'keyword' },
                                   hubName: { type: 'text' },
                                   hubCode: { type: 'keyword' },
                                   city: { type: 'text' },
                                   sequenceNumber: { type: 'integer' },
                                   arrivalTime: { type: 'keyword' },
                                   departureTime: { type: 'keyword' },
                                   distanceFromOriginKm: { type: 'float' },
                              },
                         },
                         trips: {
                              type: 'nested',
                              properties: {
                                   tripId: { type: 'keyword' },
                                   departureDate: { type: 'date' },
                                   status: { type: 'keyword' },
                                   available: { type: 'integer' },
                                   locked: { type: 'integer' },
                                   booked: { type: 'integer' },
                              },
                         },
                         capacitySummary: {
                              properties: {
                                   total: { type: 'integer' },
                                   STANDARD: { type: 'integer' },
                                   FRAGILE: { type: 'integer' },
                                   REFRIGERATED: { type: 'integer' },
                                   HAZARDOUS: { type: 'integer' },
                              },
                         },
                    },
               },
          });
          logger.info('CargoFlow vehicle index created');
     }
};

const recreateIndices = async () => {
     for (const index of [HUB_INDEX, VEHICLE_INDEX]) {
          if (await esClient.indices.exists({ index })) {
               await esClient.indices.delete({ index });
               logger.info(`Deleted index: ${index}`);
          }
     }
     await initIndices();
     logger.info('CargoFlow search indices recreated');
};

module.exports = { esClient, HUB_INDEX, VEHICLE_INDEX, initIndices, recreateIndices };
