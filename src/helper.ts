
const { resolve } = require('path');
const { readdir } = require('fs').promises;
import { Node } from 'node-red';



export interface IcalNode extends Node {

    config: any;
    red: any;

}


export async function getFiles(dir) {
    const dirents = await readdir(dir, { withFileTypes: true });
    const files = await Promise.all(dirents.map((dirent) => {
        const res = resolve(dir, dirent.name);
        return dirent.isDirectory() ? getFiles(res) : res;
    }));
    return Array.prototype.concat(...files);
}

export function isObject(item) {
    return (item && typeof item === 'object' && !Array.isArray(item));
}

export function mergeDeep(target, ...sources) {
    if (!sources.length) return target;
    const source = sources.shift();

    if (isObject(target) && isObject(source)) {
        for (const key in source) {
            if (isObject(source[key])) {
                if (!target[key]) Object.assign(target, { [key]: {} });
                mergeDeep(target[key], source[key]);
            } else {
                Object.assign(target, { [key]: source[key] });
            }
        }
    }

    return mergeDeep(target, ...sources);
}

export interface VaultConfig {
    initOptions: any;
    name: string;
    endpoint: string;
    configtoken: string;
    application: string;
    secret: string;
    action: string;
    data: any;
    config: any;
    unsealkeys: any;
    raftJoin: any;
    decodesecret: string;
}

export function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

export function getConfig(config: any, node?: any, msg?: any,RED?:any): VaultConfig {
    
    const cloudConfig = {
        name: msg?.name || config?.name,
        endpoint: config?.endpoint,        
        initOptions: RED?.util.evaluateNodeProperty(config?.initOptions, config?.initOptionsType || "json", config, msg),
        configtoken: config?.credentials?.configtoken || msg?.token,
        application: node.application,
        secret: node?.secret,
        action: node?.action || msg?.action,
        data: node.data,
        config: node?.config,
        unsealkeys: node.unsealkeys,
        decodesecret: node.decodesecret || config?.credentials?.configtoken,
        raftJoin: node.raftjoin
    } as VaultConfig;   

    if (config.configtokenenv) {
        cloudConfig.configtoken = process.env[config.configtokenenv];
    }

    return cloudConfig;
}





