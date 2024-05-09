const request = require('supertest');
const express = require('express');
const schematicsRoutes = require('../routes/schematics');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());
app.use('/schematics', schematicsRoutes);

describe('Schematics Routes', () => {
    it('should add a new schematic', async () => {
        const schematicData = { name: "New Schematic", description: "Test description" };
        const res = await request(app).post('/schematics/add').send(schematicData);
        expect(res.statusCode).toEqual(201);
        expect(res.body).toHaveProperty('id');
    });

    it('should retrieve a specific schematic', async () => {
        const res = await request(app).get('/schematics/123');
        expect(res.statusCode).toEqual(200);
        expect(res.body).toEqual({ id: "123", name: "Example Schematic", description: "A sample schematic." });
    });

    it('should delete a specific schematic', async () => {
        const res = await request(app).delete('/schematics/123');
        expect(res.statusCode).toEqual(204);
    });
});
