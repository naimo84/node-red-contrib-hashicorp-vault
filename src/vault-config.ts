module.exports = function (RED: any) {
    function configNode(config) {
        RED.nodes.createNode(this, config);

        this.name = config.name;
        this.endpoint = config.endpoint;
        this.profiles = config.profiles ;
        
        this.label = config.label ;

    }

    RED.nodes.registerType('vault-config', configNode, {
        credentials: {
            pass: { type: 'password' },
            user: { type: 'text' },
            configtoken: { type: 'password' }
        }
    });
};
