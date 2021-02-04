const client = require("cloud-config-client");


function deepen(obj) {
    const result = {};

    // For each object path (property key) in the object
    for (const objectPath in obj) {
        // Split path into component parts
        const parts = objectPath.split('.');

        // Create sub-objects along path as needed
        let target = result;
        while (parts.length > 1) {
            const part = parts.shift();
            target = target[part] = target[part] || {};
        }

        // Set value at end of path
        target[parts[0]] = obj[objectPath]
    }

    return result;
}


client.load({
    endpoint: 'http://10.1.9.21:32097',
    headers: {
        'X-Config-Token': 's.RaDIno1NGajYYB42djxzgcY4'
    },
    profiles: ['dev'],
    name: 'vbs',
    label: 'master'
})
    .then((config) => {
        console.log(JSON.stringify(deepen(config.properties)))

    })