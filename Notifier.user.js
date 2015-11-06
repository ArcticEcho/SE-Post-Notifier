// ==UserScript==
// @name         SE Active Post Notifier
// @namespace    https://github.com/ArcticEcho/SE-Post-Notifier
// @version      0.1
// @description  Adds inbox notifications for posts that you've CVd/DVd and later become active.
// @author       Sam
// @include      /^https?:\/\/(meta.)?stack(overflow|exchange).com/.*$/
// ==/UserScript==

// localStorage usage.
// DVPostsQueue    = downvoted posts (URLs) that have not yet been edited.
// CVPostsQueue    = closed posts (URLs) that have not yet been edited.
// ManPostsQueue   = manually added posts (URLs) that have not yet been edited.
// DVPostsPending  = down voted posts (URLs) that have been edited, but not yet viewed.
// CVPostsPending  = closed posts (URLs) that have been edited, but not yet viewed.
// ManPostsPending = manually added posts (URLs) that have been edited, but not yet viewed.

var _dvPostInboxItemSummary = "A post you've downvoted has been edited.";
var _cvPostInboxItemSummary = "A post you've voted to close has been edited.";
var _manPostInboxItemSummary = "A manually added post has been edited.";



var checkExist = setInterval(function()
{
    $(".topbar-icon.icon-inbox.yes-hover.js-inbox-button").click().click();
    
    if ($(".topbar-dialog.inbox-dialog .modal-content ul").length)
    {
        addDVListeners();
        fillInbox();
        clearInterval(checkExist);
    }
}, 250);

var dvPs = localStorage.getItem("DVPostsQueue");
var cvPs = localStorage.getItem("CVPostsQueue");
var manPs = localStorage.getItem("ManPostsQueue");

var watchStorage = setInterval(function()
{
    if (dvPs !== localStorage.getItem("DVPostsQueue"))
    {
        var oldIDs = dvPs.split(";");
        var newIDs = localStorage.getItem("DVPostsQueue").split(";");
        
        for (var i = 0; i < newIDs.length; i++)
        {
            if (oldIDs.indexOf(newIDs[i]) === -1)
            {
                watchPost(newIDs[i], "dv");
                dvPs.push(newIDs[i]);
            }
        }
    }
}, 500);

function watchPost(url, reason)
{
    var ws = new WebSocket("ws://qa.sockets.stackexchange.com");
    ws.onmessage = function(e)
    {
        if (JSON.parse(JSON.parse(e.data).data).a == "post-edit")
        {
            var postHtml = httpGet(url);
            var title = $(".question-hyperlink", $(postHtml)).first().text();
            var summary;
            
            switch (reason.toLowerCase())
            {
                case "dv":
                    savePost("DVPostsPending", url);
                    summary = _dvPostInboxItemSummary;
                    break;
                case "cv":
                    savePost("CVPostsPending", url);
                    summary = _cvPostInboxItemSummary;
                    break;
                case "manual":
                    savePost("ManPostsPending", url);
                    summary = _manPostInboxItemSummary;
                    break;
            }
            
            addInboxItem(url, "just now", title, summary, reason);
        }
    };
    ws.onopen = function()
    {
        ws.send("1-question-" + url.match(/questions\/\d+/gi)[0].substring(10));
    };
    
    switch (reason.toLowerCase())
    {
        case "dv":
            savePost("DVPostsQueue", url);
            break;
        case "cv":
            savePost("CVPostsQueue", url);
            break;
        case "manual":
            savePost("ManPostsQueue", url);
            break;
    }
}
    
function addDVListeners()
{
    var post = document.URL.match(/^https?:\/\/stackoverflow\.com\/questions\/\d+/gi);
    if (post === null) return;
    $(".vote-down-off").first().on("click", function() { watchPost(post[0], "dv"); });
}
                         
function removePost(key, post)
{
    var otherPosts = localStorage.getItem(key);
    
    if (otherPosts === null) return;
    
    localStorage.setItem(key, otherPosts.replace(post, ""));
}
                         
function savePost(key, post)
{
    var otherPosts = localStorage.getItem(key);
    localStorage.setItem(key, (otherPosts === null ? "" : otherPosts) + post + ";");
}

function fillInbox()
{
    var dvPosts = localStorage.getItem("DVPostsPending");
    var cvPosts = localStorage.getItem("CVPostsPending");
    var manPosts = localStorage.getItem("ManPostsPending");  
    var processPosts = function(posts, inboxItemSummary, reason)
    {
        if (posts !== null && posts.length > 0)
        {
            var urls = posts.split(";");
            
            for (var i = 0; i < urls.length; i++)
            {
                if (!urls[i] || urls[i].length === 0) continue;

                var postHtml = httpGet(urls[i]);
                var title = $(".question-hyperlink", $(postHtml)).first().text();
                var active = $(".relativetime", $(postHtml)).first().text();
                addInboxItem(urls[i], active, title, inboxItemSummary, reason);
            }
        }
    };
    
    processPosts(dvPosts, _dvPostInboxItemSummary, "dv");
    processPosts(cvPosts, _cvPostInboxItemSummary, "cv");
    processPosts(manPosts, _manPostInboxItemSummary, "manual");
}

function httpGet(url)
{
    var req = new XMLHttpRequest();
    req.open("GET", url, false);
    req.send(null);
    return req.responseText;
}

function addInboxItem(link, active, title, summary, reason)
{
	var li = document.createElement("li");
	li.setAttribute("class", "inbox-item");

	var a = document.createElement("a");
	a.setAttribute("href", link);
    a.onclick = function()
    {
        li.parentNode.removeChild(li);
        switch (reason.toLowerCase())
        {
            case "dv":
                removePost("DVPostsQueue", link);
                removePost("DVPostsPending", link);
                break;
            case "cv":
                removePost("CVPostsQueue", link);
                removePost("CVPostsPending", link);
                break;
            case "manual":
                removePost("ManPostsQueue", link);
                removePost("ManPostsPending", link);
                break;
        }
    };

	var soIcon = document.createElement("div");
	soIcon.setAttribute("class", "site-icon favicon favicon-stackoverflow");
	soIcon.setAttribute("title", "Stack Overflow");

	var iCon = document.createElement("div");
	iCon.setAttribute("class", "item-content");

	// Inbox item header
	var iHead = document.createElement("div");
	iHead.setAttribute("class", "it em-header");

	var iType = document.createElement("span");
	iType.setAttribute("class", "item-type");
	iType.appendChild(document.createTextNode("Post Active"));

	var iCreation = document.createElement("span");
	iCreation.setAttribute("class", "item-creation");
	var dt = document.createElement("span");
	dt.setAttribute("class", "relativetime");
	dt.appendChild(document.createTextNode(active));
	iCreation.appendChild(dt);

	iHead.appendChild(iType);
	iHead.appendChild(iCreation);
	
	// Inbox item location
	var iLoc = document.createElement("div");
	iLoc.setAttribute("class", "item-location");
	iLoc.appendChild(document.createTextNode(title));

	// Inbox item summary
	var iSum = document.createElement("div");
	iSum.setAttribute("class", "item-summary");
	iSum.appendChild(document.createTextNode(summary));
	
	// Stitch it all together.
	iCon.appendChild(iHead);
	iCon.appendChild(iLoc);
	iCon.appendChild(iSum);
	
	a.appendChild(soIcon);
	a.appendChild(iCon);

	li.appendChild(a);

	$(".topbar-dialog.inbox-dialog .modal-content ul").prepend(li);
    var unreadCount = $(".topbar-icon.icon-inbox.yes-hover.js-inbox-button .unread-count");
    unreadCount.removeAttr("style");
    var txt = unreadCount.text();
    unreadCount.text(parseInt(txt === null || txt.length === 0 ? "0" : txt) + 1);
}