import { getUserInfoSimple } from "@unclutter/library-components/dist/common/messaging";
import {
    extensionSupportsUrl,
    isConfiguredToEnable,
    isDeniedForDomain,
    isNonLeafPage,
    isArticleByTextContent,
} from "../common/articleDetection";
import browser from "../common/polyfill";
import { getDomain } from "@unclutter/library-components/dist/common/util";

// script injected into every tab before dom construction
// if configured by the user, initialize the extension functionality

async function boot() {
    const url = new URL(window.location.href);
    const domain = getDomain(window.location.href);

    // hard denylists
    if (!extensionSupportsUrl(url)) {
        return;
    }
    const deniedForDomain = await isDeniedForDomain(domain);
    if (deniedForDomain) {
        return;
    }

    let triggeredIsLikelyArticle = false;

    // url heuristic check
    const nonLeaf = isNonLeafPage(url);
    console.log({ nonLeaf });
    if (!nonLeaf) {
        onIsLikelyArticle(domain);
        triggeredIsLikelyArticle = true;
    }

    // TODO check annotation count in background

    if (["unclutter.lindylearn.io", "library.lindylearn.io", "localhost"].includes(domain)) {
        listenForPageEvents();
    }

    const userInfo = await getUserInfoSimple();
    if (userInfo?.aiEnabled) {
        // accessing text content requires ready dom
        await waitUntilDomLoaded();

        if (isArticleByTextContent()) {
            // enhance.ts must always be injected before highlights.ts
            // TODO run before for performance?
            requestEnhance("boot", "highlights");
        }
    }
}

async function onIsLikelyArticle(domain: string) {
    const configuredEnable = await isConfiguredToEnable(domain);
    if (configuredEnable) {
        requestEnhance("allowlisted");
    }
}

function requestEnhance(trigger: string, type = "full") {
    browser.runtime.sendMessage(null, {
        event: "requestEnhance",
        trigger,
        type,
    });
}

// handle events from the browser extension install page & integrated article library
// adding externally_connectable may not work for existing installs, and isn't supported on firefox
function listenForPageEvents() {
    window.addEventListener("message", function (event) {
        if (
            ["openOptionsPage", "openLinkWithUnclutter", "setLibraryAuth"].includes(
                event.data.event
            )
        ) {
            browser.runtime.sendMessage(event.data);
        }
    });
}

async function waitUntilDomLoaded(): Promise<void> {
    return new Promise((resolve) => {
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", () => resolve());
        } else {
            resolve();
        }
    });
}

boot();
