function logF(message: String){
    console.log("[DLsitePlay Addon] "+message);
}

enum PageType{
    Library,
    Tree,
    View,
    Settings
}

interface ProgressInfo{
    totalPage: number;
    currentPage: number;
}

class State{
    public static currentPageType: PageType;
    public static page: Page;
    
    private static observer: MutationObserver;
    private static beforeURL: string;

    public static startObserve(){
        State.observer=new MutationObserver(State.domChanged);
        State.observer.observe(document.querySelector("#root"), {childList: true, subtree: true});
    }

    private static domChanged(){
        State.checkTransition();
        State.page?.domChanged();
    }
    
    private static checkTransition(){
        if(State.beforeURL!==location.href){
            State.beforeURL=location.href;
            State.getPageType(location.href);
        }
    }

    private static getPageType(url: string){
        url=decodeURI(url);

        // /で区切られたURLから#以降を切り取る
        let path: string[]=url.split("/");
        path=path.slice(path.indexOf("#")+1);

        // 作品画面
        // work/作品ID/tree/ディレクトリパス

        // リーダー画面
        // work/作品ID/view/ファイルパス

        // 一覧画面
        // library/

        // 設定画面
        // settings/

        switch(path[0]){
            case "work":
                if(path[2]=="tree"){
                    State.currentPageType=PageType.Tree;
                    State.page=new TreePage(path);
                }
                else if(path[2]=="view"){
                    State.currentPageType=PageType.View;
                    State.page=new ViewPage(path);
                }
                break;
            case "library":
                State.currentPageType=PageType.Library;
                State.page=new LibraryPage(path);
                break;
            case "settings":
                State.currentPageType=PageType.Settings;
                State.page=new SettingsPage(path);
                break;
            default:
                State.currentPageType=undefined;
            State.page=undefined;
            break;
        }
        logF(PageType[State.currentPageType]);
    }
}

class Page{
    constructor(path: string[]){

    }

    public domChanged(){
        //DOMに変更があったとき呼び出し
    }
}

class LibraryPage extends Page{
    public readData: {[key: string]: ProductInfo};

    constructor(path: string[]){
        super(path);
        this.load();
    }

    private async load(){
        this.readData = await chrome.storage.local.get();
        console.log(this.readData)
    }

    public async domChanged() {
        setTimeout(()=>this.insertDOM(), 20);
    }
    
    private insertDOM(){
        if(!this.readData) return;
        const containers = document.querySelectorAll("[class^='_workList'] [data-test-id='virtuoso-item-list']>div");
    
        for(const item of containers){
            if(item.classList.contains("Addon_modified"))continue;
            
            // アイテムのIDを取得
            let styleAttr = item.querySelector("[class^='_thumbnail']>span")?.getAttribute("style");
            
            if(!styleAttr){
                const seriesImg = item.querySelector("[class^='_seriesThumbnail']>img");
                if(seriesImg){
                    styleAttr=(seriesImg as HTMLImageElement).src;
                }
                else{
                    continue;
                }
            }
            const id = styleAttr.match(/[^a-z]\/(?<id>[A-Z]{2}.+)_img/).groups.id;
            if(!id){
                continue;
            }

            //IDが取得できたら要素を挿入する
            const readCssClasses = {
                reading: "addon_read_reading",
                finish: "addon_read_finish"
            }
            const iconClass = item.querySelector("[class^='_icons']>[class^='_icon']").classList[0];
            if(id in this.readData){
                /*
                *  すべての本のページ数を足した進捗率を表示
                */
               const totalBookInfo: {currentPage: number, totalPage: number} = {currentPage: 0, totalPage: 0};
               for(const info of Object.values(this.readData[id])){
                   totalBookInfo.currentPage+=info.currentPage;
                   totalBookInfo.totalPage+=info.totalPage;
                }
                const progress = (totalBookInfo.currentPage-1)/(totalBookInfo.totalPage-1);
                
                const html = `
                    <span class="${iconClass} ${progress==1?readCssClasses.finish:readCssClasses.reading}">
                        ${progress==1?"読了":Math.floor(progress*100)+"%"}
                    </span>
                `

                item.querySelector("[class^='_icons']")?.insertAdjacentHTML("afterbegin", html);
            }
            item.classList.add("Addon_modified");
        }
    }
}

interface ProductInfo{
    [key: string]: ReadInfo;
}

interface ReadInfo{
    currentPage: number;
    totalPage: number;
}

class TreePage extends Page{
    private workID: string;
    private directory: string;

    constructor(path: string[]){
        super(path);
        this.workID=path[1];
        this.directory=path[3]?.replace(/%2F/g, "/");
    }
    
    public async domChanged() {
        let files: NodeListOf<Element>=document.querySelectorAll("[class^='_tree']>li");
        let datas=await chrome.storage.local.get(this.workID);

        // 登録されいなければ処理をパス
        if(Object.keys(datas).length===0)return;

        for(let file of files){
            if(file.classList.contains("Addon_modified"))continue;
            file.classList.add("Addon_modified");
            let DOM_info=file.querySelector("[class^='_info']");
            if(DOM_info.textContent.indexOf("-")==-1)continue;//フォルダだったらcontinueする

            let filename=`${this.directory||""}/${file.querySelector("[class^='_filename']").textContent}`;

            let data=undefined;
            if(datas[this.workID])data=datas[this.workID][filename];//進捗が保存されていたら要素を挿入

            if(data){
                console.log(data);
                let state_text=data.currentPage==data.totalPage?"読了":"読書中";
                let state_percent=Math.floor(((data.currentPage-1)/(data.totalPage-1))*100);

                const context=`
                    <div class="Addon_ReadState_Wrap">
                        <div class="Addon_ReadState_State" ${state_text=="読了"?"complete":""}>
                            <div>${state_text}</div>
                        </div>
                        <div class="Addon_ReadState_Percent">${state_percent}%</div>
                    </div>
                `
                DOM_info.insertAdjacentHTML("beforebegin", context);
            }
        }
    }
}

class ViewPage extends Page{
    private workID: string;
    private fileName: string;

    constructor(path: string[]){
        super(path);
        this.workID=path[1];
        this.fileName=path[3].slice(0, path[3].lastIndexOf(".")).replace(/%2F/g, "/");

        //復帰する
        this.loadPage();
    }

    private async loadPage(){
        let continuePage=(page: number)=>{
            let currentPage=ViewPage.getCurrentPage();

            if(ViewPage.getTotalPage()&&currentPage){
                let goNext=()=>(document.querySelector("[class^='_imageViewer']") as HTMLDivElement).click();

                for(let i=currentPage;i<page;i++)setTimeout(goNext);
            }
            else setTimeout(continuePage, 100, page);
        }
        
        let datas=await chrome.storage.local.get(this.workID);
        let data=null;
        console.log(datas);
        if(datas[this.workID])data=datas[this.workID][this.fileName];
        if(data){
            console.log(data);
            if(data.totalPage!==data.currentPage)continuePage(data.currentPage);
        }
    }

    public domChanged(): void {
        if(document.querySelector(".PlayAddon_SaveButton")===null &&
        document.querySelector("[class^='_bottomButtons']")!==null){
            this.insertButton();
        }

        if(
            !document.querySelector(".PlayAddon_Settings") &&
            document.querySelector("[class^='_settingsMenu']")){
            this.insertToInViewSettings();
        }
    }

    private insertToInViewSettings(){
        const html = `
            <section class="PlayAddon_Settings">
                <h2>アドオン</h2>
                <ol>
                    <li class="PlayAddon_Setting_Delete">
                        <p class="Addon_Settings_delete">このファイルの読書進捗を削除</p>
                    </li>
                </ol>
            </section>
        `

        document.querySelector("[class^='_settingsMenu']").insertAdjacentHTML("beforeend", html);
        
        document.querySelector(".PlayAddon_Setting_Delete").addEventListener("click", ()=>this.deleteHistory());
    }

    private async deleteHistory(){
        if(!window.confirm("本当にこのアイテムの読書進捗を削除しますか？"))return;
        const data = await chrome.storage.local.get(this.workID);
        delete data[this.workID][this.fileName];
        if(Object.keys(data[this.workID]).length==0){
            await chrome.storage.local.remove(this.workID);
        }
        else{
            await chrome.storage.local.set(data);
        }
        window.alert("このアイテムの読書進捗を削除しました");
        console.log("正常に削除されました");
    }

    private insertButton(){
        //進捗保存ボタンをDOMに追加する
        const context: string=`
            <button class="PlayAddon_SaveButton">
                進捗を保存
                <div></div>
            </button>
        `

        document.querySelector("[class^='_bottomButtons']").insertAdjacentHTML("afterbegin", context);

        //イベント登録
        document.querySelector(".PlayAddon_SaveButton").addEventListener("click", ()=>this.saveProgress());//thisが要素を指してしまうためアロー関数で呼び出し
    }

    private saveProgress(){
        logF("進捗を保存します");
        document.querySelector(".PlayAddon_SaveButton>div").animate(
            [{opacity: 0.6}, {opacity: 0}],
            {duration: 500, easing: "ease-out"}
        );

        console.log(`${this.workID}, ${this.fileName}`);
        ExtStorage.registInfo(this.workID, this.fileName, {totalPage: ViewPage.getTotalPage(), currentPage: ViewPage.getCurrentPage()});
    }

    private static getTotalPage(): number{
        const element=document.querySelector("[class^='_totalPage']");
        if(element)return parseInt(element.textContent);
        else return undefined;
    }

    private static getCurrentPage(): number{
        const element=document.querySelector("[class^='_currentPage']");
        if(element)return parseInt(element.textContent);
        else return undefined;
    }
}

class SettingsPage extends Page{
    constructor(path: string[]){
        super(path);
    }
    
    public domChanged(): void {
        if(document.querySelector("[class^='_settings']")!==null &&
            document.querySelector(".Addon_Settings_settings")===null){
                this.insertColumn();
        }
    }

    private insertColumn(){
        //追加の設定項目をDOMに追加する
        const version = chrome.runtime.getManifest().version;

        const context: string=`
            <section class="Addon_Settings_settings">
                <div class="Addon_Credit_wrap">
                    <div class="Addon_Credit_content">
                        <div class="Addon_Credit_name">DLsitePlay Addon ${version}</div>
                        <div class="Addon_Credit_info">保存データ数 - / 使用バイト数 -bytes</div>
                    </div>
                    <a href="https://github.com/doma-itachi/DLsitePlay-Addon" target="_blank" class="Addon_Credit_ghicon">
                        ${githubIcon}
                    </a>
                </div>
                
                <ol class="Addon_Settings_list">
                    <li class="Addon_Settings_item Addon_Settings_pointer">
                        <p class="Addon_Settings_label Addon_Settings_save">
                            読書進捗をファイルに保存
                        </p>
                    </li>
                    <li class="Addon_Settings_item Addon_Settings_pointer">
                        <p class="Addon_Settings_label Addon_Settings_load">
                            ファイルから読書進捗を復元
                        </p>
                    </li>
                    <li class="Addon_Settings_item Addon_Settings_pointer">
                        <p class="Addon_Settings_label Addon_Settings_delete">
                            アドオンのデータを初期化
                        </p>
                    </li>
                </ol>

            </section>
        `;

        document.querySelector("[class^='_settings']:last-child").insertAdjacentHTML("afterend", context);
        //イベント登録
        document.querySelector(".Addon_Settings_save").addEventListener("click", SettingsPage.saveBackup);
        document.querySelector(".Addon_Settings_load").addEventListener("click", SettingsPage.loadBackup);
        document.querySelector(".Addon_Settings_delete").addEventListener("click", SettingsPage.clearStorage);

        //非同期情報を読み込み
        const putInfo = async()=>{
            const bytes = await chrome.storage.local.getBytesInUse(null);
            const storage: { [key: string]: any } = await chrome.storage.local.get();
            document.querySelector(".Addon_Credit_info").textContent = `保存データ数 ${Object.keys(storage).length} / 使用バイト数 ${bytes}bytes`
        }
        putInfo();
    }

    private static async saveBackup(){
        logF("バックアップファイルが保存されます");
        let data=await chrome.storage.local.get(null);
        const json: string=JSON.stringify(data);
        const blob: Blob=new Blob([json], {type: "application/json"});
        let dummyElement: HTMLAnchorElement=document.createElement("a");
        document.body.appendChild(dummyElement);
        dummyElement.href=window.URL.createObjectURL(blob);
        dummyElement.download="DLsitePlay_Addon_data.json";
        dummyElement.click();
        document.body.removeChild(dummyElement);
    }

    private static loadBackup(){
        let input: HTMLInputElement=document.createElement("input");
        input.style.display="none";
        input.type="file";
        input.accept="application/json";
        input.click();
        input.addEventListener("change", ()=>{
            const reader: FileReader=new FileReader();
            reader.onload=e=>{
                chrome.storage.local.clear();
                chrome.storage.local.set(JSON.parse(e.target.result as string));
                input.style.display="block";
                input.remove();
            }
            reader.readAsText(input.files[0]);
        });
        logF("バックアップファイルから復元しました");
    }

    private static clearStorage(){
        if(window.confirm("本当にアドオンのデータを初期化しますか？（読書進捗がリセットされます）")){
            chrome.storage.local.clear();
        }
    }
}

class ExtStorage{
    static async registInfo(id: string, path: string, info: ProgressInfo){
        let data: any=await chrome.storage.local.get(id);

        if(Object.keys(data).length==0)data[id]={};
        data[id][path]=info;
        chrome.storage.local.set(data);
    }
}

const githubIcon = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z" fill="#24292f"/></svg>`

State.startObserve();
logF("アドオンはアクティブです");

// export {}