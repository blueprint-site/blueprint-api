const addonsService = require('../services/addonsService');

exports.getAddon = (req, res) => {
    addonsService.getAddon(req.params.id)
        .then(addon => res.status(200).json(addon))
        .catch(error => res.status(404).json({ message: error.message }));
};

exports.getAllAddons = (req, res) => {
    addonsService.getAllAddons()
        .then(addons => res.status(200).json(addons))
        .catch(error => res.status(500).json({ message: error.message }));
};
