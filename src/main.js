function logF(message) {
    console.log("[DLsitePlay Addon] " + message);
}
var PageType;
(function (PageType) {
    PageType[PageType["Library"] = 0] = "Library";
    PageType[PageType["Tree"] = 1] = "Tree";
    PageType[PageType["View"] = 2] = "View";
    PageType[PageType["Settings"] = 3] = "Settings";
})(PageType || (PageType = {}));
class State {
    static startObserve() {
        State.observer = new MutationObserver(State.domChanged);
        State.observer.observe(document.querySelector("#root"), { childList: true, subtree: true });
    }
    static domChanged() {
        State.checkTransition();
        State.page?.domChanged();
    }
    static checkTransition() {
        if (State.beforeURL !== location.href) {
            State.beforeURL = location.href;
            State.getPageType(location.href);
        }
    }
    static getPageType(url) {
        url = decodeURI(url);
        // /で区切られたURLから#以降を切り取る
        let path = url.split("/");
        path = path.slice(path.indexOf("#") + 1);
        // 作品画面
        // work/作品ID/tree/ディレクトリパス
        // リーダー画面
        // work/作品ID/view/ファイルパス
        // 一覧画面
        // library/
        // 設定画面
        // settings/
        switch (path[0]) {
            case "work":
                if (path[2] == "tree") {
                    State.currentPageType = PageType.Tree;
                    State.page = new TreePage(path);
                }
                else if (path[2] == "view") {
                    State.currentPageType = PageType.View;
                    State.page = new ViewPage(path);
                }
                break;
            case "library":
                State.currentPageType = PageType.Library;
                break;
            case "settings":
                State.currentPageType = PageType.Settings;
                State.page = new SettingsPage(path);
                break;
            default:
                State.currentPageType = undefined;
                State.page = undefined;
                break;
        }
        logF(PageType[State.currentPageType]);
    }
}
class Page {
    constructor(path) {
    }
    domChanged() {
        //DOMに変更があったとき呼び出し
    }
}
class TreePage extends Page {
    constructor(path) {
        super(path);
        this.workID = path[1];
        this.directory = path[3]?.replace(/%2F/g, "/");
    }
    async domChanged() {
        let files = document.querySelectorAll("[class^='WorkTreeList_tree']>li");
        let datas = await chrome.storage.local.get(this.workID);
        for (let file of files) {
            if (file.classList.contains("Addon_modified"))
                continue;
            file.classList.add("Addon_modified");
            let DOM_info = file.querySelector("[class^='WorkTreeList_info']");
            if (DOM_info.textContent.indexOf("-") == -1)
                continue; //フォルダだったらcontinueする
            let filename = `${this.directory}/${file.querySelector("[class^='WorkTreeList_filename']").textContent}`;
            let data = undefined;
            if (datas[this.workID])
                data = datas[this.workID][filename]; //進捗が保存されていたら要素を挿入
            if (data) {
                console.log(data);
                let state_text = data.currentPage == data.totalPage ? "読了" : "読書中";
                let state_percent = Math.floor(data.currentPage / data.totalPage * 100);
                const context = `
                    <div class="Addon_ReadState_Wrap">
                        <div class="Addon_ReadState_State" ${state_text == "読了" ? "complete" : ""}>
                            <div>${state_text}</div>
                        </div>
                        <div class="Addon_ReadState_Percent">${state_percent}%</div>
                    </div>
                `;
                DOM_info.insertAdjacentHTML("beforebegin", context);
            }
        }
    }
}
class ViewPage extends Page {
    constructor(path) {
        super(path);
        this.workID = path[1];
        this.fileName = path[3].slice(0, path[3].lastIndexOf(".")).replace(/%2F/g, "/");
        //復帰する
        this.loadPage();
    }
    async loadPage() {
        let continuePage = (page) => {
            let currentPage = ViewPage.getCurrentPage();
            if (ViewPage.getTotalPage() && currentPage) {
                let goNext = () => document.querySelector("[class^='ImageViewer_imageViewer']").click();
                for (let i = currentPage; i < page; i++)
                    setTimeout(goNext);
            }
            else
                setTimeout(continuePage, 100, page);
        };
        let datas = await chrome.storage.local.get(this.workID);
        let data = null;
        console.log(datas);
        if (datas[this.workID])
            data = datas[this.workID][this.fileName];
        if (data) {
            console.log(data);
            if (data.totalPage !== data.currentPage)
                continuePage(data.currentPage);
        }
    }
    domChanged() {
        if (document.querySelector(".PlayAddon_SaveButton") === null &&
            document.querySelector("[class^='ImageViewerControls_bottomButtons']") !== null) {
            this.insertButton();
        }
    }
    insertButton() {
        //進捗保存ボタンをDOMに追加する
        const context = `
            <button class="PlayAddon_SaveButton">
                進捗を保存
                <div></div>
            </button>
        `;
        document.querySelector("[class^='ImageViewerControls_bottomButtons']").insertAdjacentHTML("afterbegin", context);
        //イベント登録
        document.querySelector(".PlayAddon_SaveButton").addEventListener("click", () => this.saveProgress()); //thisが要素を指してしまうためアロー関数で呼び出し
    }
    saveProgress() {
        logF("進捗を保存します");
        document.querySelector(".PlayAddon_SaveButton>div").animate([{ opacity: 0.6 }, { opacity: 0 }], { duration: 500, easing: "ease-out" });
        console.log(`${this.workID}, ${this.fileName}`);
        ExtStorage.registInfo(this.workID, this.fileName, { totalPage: ViewPage.getTotalPage(), currentPage: ViewPage.getCurrentPage() });
    }
    static getTotalPage() {
        const element = document.querySelector("[class^='ImageViewerPageCounter_totalPage']");
        if (element)
            return parseInt(element.textContent);
        else
            return undefined;
    }
    static getCurrentPage() {
        const element = document.querySelector("[class^='ImageViewerPageCounter_currentPage']");
        if (element)
            return parseInt(element.textContent);
        else
            return undefined;
    }
}
class SettingsPage extends Page {
    constructor(path) {
        super(path);
    }
    domChanged() {
        if (document.querySelector("[class^='Settings_settings']") !== null &&
            document.querySelector(".Addon_Settings_settings") === null) {
            this.insertColumn();
        }
    }
    insertColumn() {
        //追加の設定項目をDOMに追加する
        const context = `
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
        `;
        document.querySelector("[class^='Settings_settings']:last-child").insertAdjacentHTML("afterend", context);
        //イベント登録
        document.querySelector(".Addon_Settings_save").addEventListener("click", SettingsPage.saveBackup);
        document.querySelector(".Addon_Settings_load").addEventListener("click", SettingsPage.loadBackup);
        document.querySelector(".Addon_Settings_delete").addEventListener("click", SettingsPage.clearStorage);
    }
    static async saveBackup() {
        logF("バックアップファイルが保存されます");
        let data = await chrome.storage.local.get(null);
        const json = JSON.stringify(data);
        const blob = new Blob([json], { type: "application/json" });
        let dummyElement = document.createElement("a");
        document.body.appendChild(dummyElement);
        dummyElement.href = window.URL.createObjectURL(blob);
        dummyElement.download = "DLsitePlay_Addon_data.json";
        dummyElement.click();
        document.body.removeChild(dummyElement);
    }
    static loadBackup() {
        let input = document.createElement("input");
        input.style.display = "none";
        input.type = "file";
        input.accept = "application/json";
        input.click();
        input.addEventListener("change", () => {
            const reader = new FileReader();
            reader.onload = e => {
                chrome.storage.local.clear();
                chrome.storage.local.set(JSON.parse(e.target.result));
                input.style.display = "block";
                input.remove();
            };
            reader.readAsText(input.files[0]);
        });
        logF("バックアップファイルから復元しました");
    }
    static clearStorage() {
        if (window.confirm("本当にアドオンのデータを初期化しますか？（読書進捗がリセットされます）")) {
            chrome.storage.local.clear();
        }
    }
}
class ExtStorage {
    static async registInfo(id, path, info) {
        let data = await chrome.storage.local.get(id);
        if (Object.keys(data).length == 0)
            data[id] = {};
        data[id][path] = info;
        chrome.storage.local.set(data);
    }
}
// class Page{
// }
State.startObserve();
logF("アドオンはアクティブです");
// export {}
