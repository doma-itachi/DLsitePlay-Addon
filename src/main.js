class State{
    constructor(){
        this.pageType;
        this.selectedID;
        this.path;
        this.currentDirectory;
        this.viewFileName;
    }

    static PageType={
        library: 0,
        tree: 1,
        view: 2,
        settings: 3
    }

    getRoute(URL){
        URL=decodeURI(URL);
        let path=[];
        let urlArray=URL.split("/");
        for(let i=0;i<urlArray.length;i++){
            if(urlArray[i]==="#"){
                path=urlArray.slice(i+1);
                break;
            }
        }

        logf("ページは"+path[0]+"です");

        this.selectedID=undefined;

        switch(path[0]){
            case "work":
                this.selectedID=path[1];
                logf("selectedID="+this.selectedID);
                switch(path[2]){
                    case "tree":
                        this.pageType=State.PageType.tree;
                        if(path[3]!==undefined)
                            this.currentDirectory=path[3].replace(/%2F/g, "/");
                        console.log(this.currentDirectory);
                        break;
                    case "view":
                        this.pageType=State.PageType.view;
                        this.viewFileName=path[3].slice(0, path[3].lastIndexOf(".")).replace(/%2F/g, "/");
                        console.log(this.viewFileName);
                        break;
                }
                break;
            case "library":
                this.pageType=State.PageType.library;
                break;
            case "settings":
                this.pageType=State.PageType.settings;
                break;
        }
    }
}

class Storage{
    static async getAll(id){
        console.log(await browser.storage.local.get(id));
    }

    static getInfo(id, path){

    }

    static async registInfo(id, path, info){
        // let buffer={[id]:{[path]:info}};
        let data=await browser.storage.local.get(id);
        // console.log(Object.keys(data).length);
        if(Object.keys(data).length==0){
            data[id]={};
        }
        data[id][path]=info;
        console.log(data);
        browser.storage.local.set(data);
    }
}

class DOMMgr{
    static getTotalPage(){
        let element=document.querySelector("[class^='ImageViewerPageCounter_totalPage']");
        if(element==null){
            return undefined;
        }
        return parseInt(element.textContent);
    }
    static getCurrentPage(){
        let element=document.querySelector("[class^='ImageViewerPageCounter_currentPage']");
        if(element==null){
            return undefined;
        }
        return parseInt(element.textContent);
    }
}

function logf(msg){
    console.log(`[DLsitePlay_Addon] ${msg}`);
}

//拡張機能の初期化
let state=new State();
let currentURL=location.href;
state.getRoute(currentURL);

logStorage();

async function logStorage(){
    console.log(await browser.storage.local.get(null));

}

let observer=new MutationObserver(async ()=>{
    //URLが変わったとき
    if(currentURL!=location.href){
        currentURL=location.href;
        state.getRoute(currentURL);

        if(state.pageType===State.PageType.view){
            let continuePage=(page)=>{
                let currentPage=DOMMgr.getCurrentPage();
                if(DOMMgr.getTotalPage!=undefined &&
                currentPage!=undefined){
                    for(let i=currentPage;i<page;i++){
                        document.querySelector("[class^='ImageViewer_imageViewer']").click();
                    }
                }
                else setTimeout(continuePage, 100, page);
            }

            let datas=await browser.storage.local.get(state.selectedID);
            let data=undefined;
            if(datas[state.selectedID]!==undefined)
                data=datas[state.selectedID][state.viewFileName];
            if(data!==undefined){
                console.log(data);
                if(data.totalPage!==data.currentPage){
                    continuePage(data.currentPage);
                }
            }
        }
    }

    if(state.pageType===State.PageType.tree){
        let items=document.querySelectorAll("[class^='WorkTreeList_tree']>li");
        let datas=await browser.storage.local.get(state.selectedID);
        for(let item of items){
            //改変済みだったらパス
            if(item.classList.contains("Addon_modified"))continue;
            item.classList.add("Addon_modified");
            let DOM_info=item.querySelector("[class^='WorkTreeList_info']");
            //フォルダだったらcontinue
            if(DOM_info.textContent.indexOf("-")==-1){
                continue;
            }

            //URLとファイル名から絶対パスを作成
            let filename=state.currentDirectory+"/"+item.querySelector("[class^='WorkTreeList_filename']").textContent;
            // console.log(filename);

            //要素を挿入
            let data=undefined;
            if(datas[state.selectedID]!==undefined)
                data=datas[state.selectedID][filename];

            if(data!=undefined){
                console.log(data);
                let state_text=data.currentPage==data.totalPage?"読了":"読書中";
                let state_percent=Math.floor(data.currentPage/data.totalPage*100);
                DOM_info.insertAdjacentHTML("beforebegin", `
                    <div class="Addon_ReadState_Wrap">
                        <div class="Addon_ReadState_State" ${state_text=="読了"?"complete":""}>
                            <div>${state_text}</div>
                        </div>
                        <div class="Addon_ReadState_Percent">${state_percent}%</div>
                    </div>
                `);
            }
        }
    }

    if(state.pageType===State.PageType.view &&
        document.querySelector(".PlayAddon_SaveButton")===null&&
        document.querySelector("[class^='ImageViewerControls_bottomButtons']")!==null){
        //メニューが表示されたらボタンを追加する。
        document.querySelector("[class^='ImageViewerControls_bottomButtons']").insertAdjacentHTML(
            "afterbegin",
            `<button class="PlayAddon_SaveButton">
                進捗を保存
                <div></div>
            </button>
            `
        );
        document.querySelector(".PlayAddon_SaveButton").addEventListener("touchend", ()=>{
            logf(state.selectedID+"保存されました");

            document.querySelector(".PlayAddon_SaveButton>div").animate(
                [{opacity: 0.3},{opacity:0}],
                {duration:500, easing:"ease-out"}
            );

            Storage.registInfo(state.selectedID, state.viewFileName, {totalPage: DOMMgr.getTotalPage(), currentPage: DOMMgr.getCurrentPage()});
        });
    }

    if(state.pageType===State.PageType.settings){
        if(document.querySelector("[class^='Settings_settings']")!==null &&
        document.querySelector(".Addon_Settings_settings")===null){
            document.querySelector("[class^='Settings_settings']:last-child").insertAdjacentHTML("afterend",`
                <section class="Addon_Settings_settings">
                    <h2 class="Addon_Settings_title">アドオン</h2>
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
            `);

            //イベントの登録
            document.querySelector(".Addon_Settings_save").addEventListener("click", async e=>{
                logf("バックアップファイルが保存されます");
                let data=await browser.storage.local.get(null);
                let json=JSON.stringify(data);
                const blob=new Blob([json], {type: "application/json"});
                let dummyElement=document.createElement("a");
                document.body.appendChild(dummyElement);
                dummyElement.href=window.URL.createObjectURL(blob);
                dummyElement.download="DLsitePlay_data.json";
                dummyElement.click();
                document.body.removeChild(dummyElement);
            });
            
            document.querySelector(".Addon_Settings_load").addEventListener("click", e=>{
                let input=document.createElement("input");
                input.style.display="none";
                input.type="file";
                input.accept="application/json";
                input.click();
                input.addEventListener("change", ()=>{
                    const reader=new FileReader();
                    reader.onload=(e)=>{
                        browser.storage.local.clear();
                        browser.storage.local.set(JSON.parse(e.target.result));
                        input.style.display="block";
                        input.remove();
                    }
                    reader.readAsText(input.files[0]);
                });
                logf("バックアップファイルから復元しました");
            });
            
            document.querySelector(".Addon_Settings_delete").addEventListener("click", e=>{
                if(window.confirm("本当にアドオンのデータを初期化しますか？（読書進捗がリセットされます）")){
                    browser.storage.local.clear();
                }
            });

        }
    }
});
observer.observe(document.querySelector("#root"), {childList: true, subtree: true});

//要素を取得するときには[class^='クラス']を使う
logf("アドオンはアクティブです");