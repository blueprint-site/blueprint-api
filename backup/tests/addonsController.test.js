const request = require('supertest');
const express = require('express');
const addonsRoutes = require('../routes/addons');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());
app.use('/addons', addonsRoutes);

describe('Addons Routes', () => {
    it('should retrieve all addons', async () => {
        const res = await request(app).get('/addons');
        expect(res.statusCode).toEqual(200);
        expect(res.body).toEqual([
            { id: 1, name: "SkyBlock", description: "SkyBlock addon for Minecraft" },
            { id: 2, name: "CastleDefenders", description: "Defend your castle with this mod!" }
        ]);
    });

    it('should retrieve a single addon', async () => {
        const res = await request(app).get('/addons/1');
        expect(res.statusCode).toEqual(200);
        expect(res.body).toEqual({ id:1, name: "SkyBlock", description: "SkyBlock addon for Minecraft" });
    });
});