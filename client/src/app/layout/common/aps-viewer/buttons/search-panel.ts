declare const Autodesk: any;

export class SearchPanel extends Autodesk.Viewing.UI.DockingPanel {
    private viewer: any;
    private searchField: HTMLInputElement;
    private searchButton: HTMLButtonElement;
    private dbIdRadio: HTMLInputElement;
    private propertyRadio: HTMLInputElement;
    private resultsDiv: HTMLDivElement;

    constructor(viewer: any, container: HTMLElement, id: string, title: string, options?: any) {
        super(container, id, title, options);
        this.viewer = viewer;

        // 設置面板樣式
        this.container.classList.add('docking-panel-container-solid-color-a');
        this.container.style.top = '10px';
        this.container.style.left = '10px';
        this.container.style.width = 'auto';
        this.container.style.height = 'auto';
        this.container.style.resize = 'auto';

        // 創建內容容器
        const div = document.createElement('div');
        div.className = 'p-4'; // Tailwind: padding 1rem

        // 創建 radio button 容器
        const radioContainer = document.createElement('div');
        radioContainer.className = 'flex space-x-4 mb-4'; // Tailwind: flex 布局，水平間距 1rem，底部間距 1rem

        // 創建 dbId 搜尋 radio button
        this.dbIdRadio = document.createElement('input');
        this.dbIdRadio.type = 'radio';
        this.dbIdRadio.id = 'dbIdSearch';
        this.dbIdRadio.name = 'searchType';
        this.dbIdRadio.value = 'dbId';
        this.dbIdRadio.checked = true; // 預設選取
        this.dbIdRadio.className = 'mr-1'; // Tailwind: 右邊距 0.25rem
        radioContainer.appendChild(this.dbIdRadio);

        const dbIdLabel = document.createElement('label');
        dbIdLabel.htmlFor = 'dbIdSearch';
        dbIdLabel.innerText = 'dbId 搜尋';
        dbIdLabel.className = 'text-base'; // Tailwind: 文字大小 sm
        radioContainer.appendChild(dbIdLabel);

        // 創建一般屬性搜尋 radio button
        this.propertyRadio = document.createElement('input');
        this.propertyRadio.type = 'radio';
        this.propertyRadio.id = 'propertySearch';
        this.propertyRadio.name = 'searchType';
        this.propertyRadio.value = 'property';
        this.propertyRadio.className = 'mr-1'; // Tailwind: 右邊距 0.25rem
        radioContainer.appendChild(this.propertyRadio);

        const propertyLabel = document.createElement('label');
        propertyLabel.htmlFor = 'propertySearch';
        propertyLabel.innerText = '屬性搜尋';
        propertyLabel.className = 'text-base'; // Tailwind: 文字大小 sm
        radioContainer.appendChild(propertyLabel);

        div.appendChild(radioContainer);

        // 創建搜尋輸入框和按鈕容器
        const inputContainer = document.createElement('div');
        inputContainer.className = 'flex space-x-2'; // Tailwind: flex 布局，水平間距 0.5rem

        // 創建搜尋輸入框
        this.searchField = document.createElement('input');
        this.searchField.type = 'text';
        this.searchField.id = 'search-field';
        this.searchField.placeholder = '輸入 dbId 或屬性值...';
        this.searchField.className = 'border rounded px-2 py-2 text-base w-40'; // Tailwind: 邊框、圓角、內距、文字大小、寬度
        inputContainer.appendChild(this.searchField);

        // 創建搜尋按鈕
        this.searchButton = document.createElement('button');
        this.searchButton.type = 'button';
        this.searchButton.id = 'btn-search';
        this.searchButton.innerText = 'Search';
        this.searchButton.className = 'bg-blue-500 text-white px-4 py-1 rounded hover:bg-blue-600 text-sm'; // Tailwind: 藍色背景、白色文字、內距、圓角、hover 效果
        inputContainer.appendChild(this.searchButton);

        div.appendChild(inputContainer);

        // 創建搜尋結果容器
        this.resultsDiv = document.createElement('div');
        this.resultsDiv.id = 'search-results';
        this.resultsDiv.className = 'my-4 text-sm'; // Tailwind: 頂部間距、文字大小
        div.appendChild(this.resultsDiv);

        // 綁定事件
        this.searchButton.addEventListener('click', () => this.searchItems());
        this.searchField.addEventListener('keyup', (event) => {
            if (event.key === 'Enter') {
                this.searchButton.click();
            }
        });

        this.container.appendChild(div);
    }

    private searchItems(): void {
        const searchValue = this.searchField.value.trim();
        this.resultsDiv.innerText = ''; // 清空結果顯示

        if (searchValue === '') {
            this.viewer.fitToView();
            this.resultsDiv.innerText = '請輸入搜尋值';
            return;
        }

        // 取得所有已載入的模型
        const models = this.viewer.getAllModels?.() || [this.viewer.model];

        if (this.dbIdRadio.checked) {
            // dbId 搜尋
            const dbIds = searchValue
                .split(',')
                .map(value => parseInt(value.trim()))
                .filter(id => !isNaN(id));

            if (dbIds.length === 0) {
                this.resultsDiv.innerText = '請輸入有效的 dbId（數字或逗號分隔的數字）';
                return;
            }

            let found = false;
            for (const model of models) {
                const validDbIds = dbIds.filter(dbId => model.getData().instanceTree?.nodeAccess.dbIdToIndex[dbId] != null);
                if (validDbIds.length > 0) {
                    // 隔離物件
                    this.viewer.isolate(validDbIds, model);
                    this.viewer.fitToView(validDbIds, model);

                    // 獲取屬性
                    // validDbIds.forEach(dbId => this.getProperty(dbId, model));

                    // 選取物件樹中的節點
                    const tree = model.getInstanceTree();
                    if (tree && this.viewer.modelstructure) {
                        validDbIds.forEach(dbId => {
                            const nodePath = this.getNodePath(tree, dbId);
                            if (nodePath) {
                                this.expandNodePathInTree(tree, nodePath, this.viewer.modelstructure, model);
                            }
                        });
                    }

                    found = true;
                }
            }

            if (!found) {
                this.resultsDiv.innerText = `未找到 dbId: ${dbIds.join(', ')}`;
            } else {
                this.resultsDiv.innerText = `已隔離並選取 dbId: ${dbIds.join(', ')}`;
            }
            return;
        }

        // 一般屬性搜尋
        this.viewer.search(searchValue, (dbIDs: number[]) => {
            let anyIsolated = false;
            for (const model of models) {
                const modelDbIDs = dbIDs.filter(dbId => model.getInstanceTree()?.nodeAccess.dbIdToIndex[dbId] != null);
                if (modelDbIDs.length > 0) {
                    // 隔離物件
                    this.viewer.isolate(modelDbIDs, model);
                    this.viewer.fitToView(modelDbIDs, model);

                    // 選取物件樹中的節點
                    // const tree = model.getInstanceTree();
                    // if (tree && this.viewer.modelstructure) {
                    //     modelDbIDs.forEach(dbId => {
                    //         const nodePath = this.getNodePath(tree, dbId);
                    //         if (nodePath) {
                    //             this.expandNodePathInTree(tree, nodePath, this.viewer.modelstructure, model);
                    //         }
                    //     });
                    // }

                    anyIsolated = true;
                }
            }
            this.resultsDiv.innerText = anyIsolated
                ? `找到 ${dbIDs.length} 個匹配的物件，已隔離並選取`
                : `未找到匹配 "${searchValue}" 的物件`;
        }, (error: any) => {
            this.resultsDiv.innerText = `搜尋錯誤: ${error}`;
        });
    }

    private getProperty(dbId: number, model: any): void {
        model.getProperties(dbId, (result: any) => {
            const filteredProperties = result.properties.filter((prop: any) => prop.displayName.startsWith('COBie'));
            const name = result.name ||
                filteredProperties.find((prop: any) => prop.displayName === 'COBie.Space.Name')?.displayValue ||
                filteredProperties.find((prop: any) => prop.displayName === 'Name')?.displayValue ||
                '未知';
            console.log(`Properties for dbId ${dbId} in model ${model.getData().urn || 'unknown'}:`, { name, properties: filteredProperties });
        }, (error: any) => {
            console.error(`無法獲取 dbId ${dbId} 的屬性:`, error);
        });
    }

    private getNodePath(tree: any, dbid: number): number[] | null {
        const path: number[] = [];
        let currentDbId = dbid;

        if (typeof tree.getNodeParentId !== 'function') {
            console.error('樹缺少 getNodeParentId 方法:', tree);
            return null;
        }

        while (currentDbId !== null) {
            path.unshift(currentDbId);
            const parentId = tree.getNodeParentId(currentDbId);
            if (parentId === null || parentId === tree.getRootId()) {
                break;
            }
            currentDbId = parentId;
        }
        return path;
    }

    private expandNodePathInTree(tree: any, nodePath: any, modelStructure: any, model: any) {       
        if (modelStructure) {
            nodePath.forEach((dbId: number) => {
                this.viewer.select([dbId], model);
            });
        } else {
            console.error('無法獲取 modelStructure');
        }
    }
}