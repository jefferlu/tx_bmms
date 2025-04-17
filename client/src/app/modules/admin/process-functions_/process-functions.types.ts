export interface BimModel {
    id: number;
    tender: string;
    name: string;
    categories: { id: number }[];
}

export interface BimCategory {
    id: number;
    value: string;
    display_name: string;
    bim_group: number;
    conversion?: any; // 如果有具體結構，可進一步定義
    selected?: boolean; // 用於選擇狀態
}

export interface BimGroup {
    id: number;
    name: string;
    description: string;
    order: number;
    bim_categories: BimCategory[];
    collapse?: boolean; // 用於折疊狀態
}

export interface SearchResult {
    count: number;
    results: any[]; // 根據實際後端回傳結構進一步定義
}

export interface SearchResultItem {
    id: number;
    model_name: string;
    version: string;
    group_name: string;
    category: string;
    value: string;
    dbid: number;
}

export interface RouteData {
    data: {
        models: BimModel[];
        groups: BimGroup[];
    };
}