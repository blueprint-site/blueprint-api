const schematicsService = require('../services/schematicsService');

exports.addSchematic = (req, res) => {
    schematicsService.addSchematic(req.body)
        .then(result => res.status(201).send(result))
        .catch(error => res.status(500).send(error.message));
};

exports.getSchematic = (req, res) => {
    schematicsService.getSchematic(req.params.id)
        .then(schematic => res.status(200).send(schematic))
        .catch(error => res.status(404).send(error.message));
};

exports.deleteSchematic = (req, res) => {
    schematicsService.deleteSchematic(req.params.id)
        .then(() => res.status(204).send())
        .catch(error => res.status(500).send(error.message));
};
