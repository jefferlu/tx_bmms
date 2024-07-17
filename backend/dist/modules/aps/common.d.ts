import { AuthenticationClient, BIM360Client, DataManagementClient, IBucket, IObject, ModelDerivativeClient, WebhooksClient } from "forge-server-utils";
import { IAuthOptions } from "forge-server-utils/dist/common";
import { IEnvironment } from "./environments";
export interface IPreviewSettings {
    extensions: string[];
    env?: string;
    api?: string;
}
export interface IContext {
    credentials: IAuthOptions;
    environment: IEnvironment;
    authenticationClient: AuthenticationClient;
    dataManagementClient: DataManagementClient;
    modelDerivativeClient2L: ModelDerivativeClient;
    modelDerivativeClient3L: ModelDerivativeClient;
    webhookClient: WebhooksClient;
    bim360Client: BIM360Client;
    threeLeggedToken?: string;
}
export declare function showErrorMessage(title: string, err: any): Promise<string>;
export declare function promptBucket(context: IContext, bucketKey?: string): Promise<IBucket | undefined>;
export declare function promptObject(context: IContext, bucketKey: string, objectKey?: string): Promise<any>;
export declare function getURN(object: IObject): string;
export declare function getModelDerivativeClientForObject(object: IObject, context: IContext): ModelDerivativeClient;
export declare function promptDerivative(context: IContext, objectId: string): Promise<any | undefined>;
export declare function findViewable(derivative: any): any;
