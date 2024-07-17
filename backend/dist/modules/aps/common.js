"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findViewable = exports.promptDerivative = exports.getModelDerivativeClientForObject = exports.getURN = exports.promptObject = exports.promptBucket = exports.showErrorMessage = void 0;
const forge_server_utils_1 = require("forge-server-utils");
async function showErrorMessage(title, err) {
    let msg = title;
    if (typeof err === 'string') {
        msg += ': ' + err;
    }
    else if (typeof err === 'object') {
        if (err.message) {
            msg += ': ' + err.message;
        }
    }
    return msg;
}
exports.showErrorMessage = showErrorMessage;
async function promptBucket(context, bucketKey) {
    const buckets = await context.dataManagementClient.listBuckets();
    if (!bucketKey) {
        return undefined;
    }
    else {
        return buckets.find(item => item.bucketKey === bucketKey);
    }
}
exports.promptBucket = promptBucket;
async function promptObject(context, bucketKey, objectKey) {
    const objects = await context.dataManagementClient.listObjects(bucketKey);
    if (!objectKey) {
        return objects;
    }
    else {
        return objects.find(item => item.objectKey === objectKey);
    }
}
exports.promptObject = promptObject;
function getURN(object) {
    return (0, forge_server_utils_1.urnify)(object.objectId).replace('/', '_');
}
exports.getURN = getURN;
function getModelDerivativeClientForObject(object, context) {
    if ('objectId' in object) {
        return context.modelDerivativeClient2L;
    }
}
exports.getModelDerivativeClientForObject = getModelDerivativeClientForObject;
async function promptDerivative(context, objectId) {
    const urn = (0, forge_server_utils_1.urnify)(objectId);
    const manifest = await context.modelDerivativeClient2L.getManifest(urn);
    const svf = manifest.derivatives.find((deriv) => deriv.outputType === 'svf');
    console.log(manifest.derivatives);
    if (!svf) {
        return undefined;
    }
    const derivatives = svf.children.filter((child) => child.type === 'geometry').map((geometry) => {
        return {
            urn: urn,
            name: geometry.name,
            role: geometry.role,
            guid: geometry.guid,
            bubble: geometry
        };
    });
    console.log(derivatives);
    const derivativeName = 'Scene';
    return derivatives[0];
}
exports.promptDerivative = promptDerivative;
function findViewable(derivative) {
    return derivative.bubble.children.find((child) => child.role === 'graphics' || child.role === 'pdf-page');
}
exports.findViewable = findViewable;
//# sourceMappingURL=common.js.map