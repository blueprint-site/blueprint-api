// Here, you might normally interact with a database
exports.getAddon = async (id) => {
    // get from database or external API
    id = parseInt(id);
    return { id: id, name: "SkyBlock", description: "SkyBlock addon for Minecraft" };
};

exports.getAllAddons = async () => {
    // get all addons
    return [
        { id: 1, name: "SkyBlock", description: "SkyBlock addon for Minecraft" },
        { id: 2, name: "CastleDefenders", description: "Defend your castle with this mod!" }
    ];
};
