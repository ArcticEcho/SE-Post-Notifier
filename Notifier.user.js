// ==UserScript==
// @name         SE Active Post Notifier
// @namespace    https://github.com/ArcticEcho/SE-Post-Notifier
// @version      0.3.1
// @description  Adds inbox notifications for posts that you've CVd/DVd and later become active.
// @author       Sam
// @include      /^https?:\/\/stack(overflow|exchange).com/
// ==/UserScript==

// localStorage usage.
// DVPostsQueue    = downvoted posts (URLs) that have not been edited since being downvoted.
// DVPostsPending  = down voted posts (URLs) that have been edited, but not yet viewed.
// CVPostsQueue    = close voted posts (URLs) that have not been edited since being close voted.
// CVPostsPending  = close voted posts (URLs) that have been edited, but not yet viewed.
// ManPostsQueue   = manually added posts (URLs) that have not yet been edited.
// ManPostsPending = manually added posts (URLs) that have been edited, but not yet viewed.

var _dvPostInboxItemSummary = "A post you've downvoted has been edited.";
var _cvPostInboxItemSummary = "A post you've voted to close has been edited.";
var _manPostInboxItemSummary = "A manually added post has been edited.";

var _dvPs = localStorage.getItem("DVPostsQueue");
var _cvPs = localStorage.getItem("CVPostsQueue");
var _manPs = localStorage.getItem("ManPostsQueue");

var _watching = [ "" ];



var checkExist = setInterval(function()
{
    $(".topbar-icon.icon-inbox.yes-hover.js-inbox-button").click().click();
    
    if ($(".topbar-dialog.inbox-dialog .modal-content ul").length)
    {
        addDVListeners();
        fillInbox();
        addWatchBtn();
        watchOldPosts();
        clearInterval(checkExist);
    }
}, 250);

var watchStorage = setInterval(function()
{
    var newDvPs = localStorage.getItem("DVPostsQueue");
    if (_dvPs !== newDvPs)
    {
        var oldIDs = (!_dvPs ? "" : _dvPs).split(";");
        var newIDs = (!newDvPs ? "" : newDvPs).split(";");
        
        for (var i = 0; i < newIDs.length; i++)
        {
            if (oldIDs.indexOf(newIDs[i]) === -1)
            {
                watchPost(newIDs[i], "dv");
                _dvPs += newIDs[i] + ";";
            }
        }
    }
}, 500);

function watchOldPosts()
{
    var dvUrls = (_dvPs === null ? "" : _dvPs).split(";");
    var cvUrls = (_cvPs === null ? "" : _cvPs).split(";");
    var manUrls = (_manPs === null ? "" : _manPs).split(";");
    
    for (var i = 0; i < dvUrls.length; i++)
        if (dvUrls[i].length > 0)
            watchPost(dvUrls[i], "dv");
    
    for (var i = 0; i < cvUrls.length; i++)
        if (cvUrls[i].length > 0)
            watchPost(cvUrls[i], "cv");
    
    for (var i = 0; i < manUrls.length; i++)
        if (manUrls[i].length > 0)
            watchPost(manUrls[i], "man");
}

function watchPost(url, reason)
{
    console.log("Request to watch post: " + url);
    
    if (!url || url.length === 0 || _watching.indexOf(url) !== -1) { console.log("Rejected.\n\n"); return; }
    
    console.log("Accepted.\n\n");
    
    _watching.push(url);
    
    var ws = new WebSocket("wss://qa.sockets.stackexchange.com");
    var postID = url.match(/questions\/\d+/gi)[0].substring(10);
    ws.onmessage = function(e)
    {
        var a = "";
        
        try
        {
            a = JSON.parse(JSON.parse(e.data).data).a;
        }
        catch (ex) { }
        
        if (a == "post-edit")
        {
            var summary;
            
            switch (reason.toLowerCase())
            {
                case "dv":
                    var pts = localStorage.getItem("DVPostsQueue");
                    if (!pts || pts.indexOf(url) === -1) return;
                    savePost("DVPostsPending", url);
                    summary = _dvPostInboxItemSummary;
                    break;
                case "cv":
                    var pts = localStorage.getItem("CVPostsQueue");
                    if (!pts || pts.indexOf(url) === -1) return;
                    savePost("CVPostsPending", url);
                    summary = _cvPostInboxItemSummary;
                    break;
                case "man":
                    var pts = localStorage.getItem("ManPostsQueue");
                    if (!pts || pts.indexOf(url) === -1) return;
                    savePost("ManPostsPending", url);
                    summary = _manPostInboxItemSummary;
                    break;
            }
            
            var postHtml = httpGet(url);
            var title = $(".question-hyperlink", $(postHtml)).first().text();
            
            addInboxItem(url, "just now", title, summary, reason);
            ws.close();
        }
    };
    ws.onopen = function()
    {
        ws.send("1-question-" + postID);
    };
    
    switch (reason.toLowerCase())
    {
        case "dv":
            savePost("DVPostsQueue", url);
            break;
        case "cv":
            savePost("CVPostsQueue", url);
            break;
        case "man":
            savePost("ManPostsQueue", url);
            break;
    }
}
    
function addWatchBtn()
{
    var url = document.URL.match(/^https?:\/\/stackoverflow\.com\/questions\/\d+/gi);
    
    if (!url) return;
    
    var a = document.createElement("a");
    a.setAttribute("title", "Start receiving notifications for this post.");
    a.setAttribute("id", "watch-post");
    a.appendChild(document.createTextNode("watch"));
    a.onclick = function()
    {
        var txt = $(".post-menu #watch-post").first().text();
        
        if (txt == "watch")
        {
            $(".post-menu #watch-post").first().text("unwatch");
            a.setAttribute("title", "Stop receiving notifications for this post.");
            watchPost(url[0], "man");
        }
        else
        {
            $(".post-menu #watch-post").first().text("watch");
            a.setAttribute("title", "Start receiving notifications for this post.");
            removePost("ManPostsQueue", url[0]);
        }
    };
    
    var span = document.createElement("span");
    span.setAttribute("class", "lsep");
    span.appendChild(document.createTextNode("|"));
    
    $(".post-menu").first().append(span).append(a);
}
    
function addDVListeners()
{
    var post = document.URL.match(/^https?:\/\/stackoverflow\.com\/questions\/\d+/gi);
    if (post == null) return;
    $(".vote-down-off").first().on("click", function() { watchPost(post[0], "dv"); });
}
                         
function removePost(key, post)
{
    for (var i = 0; i < _watching.length; i++)
        if (_watching[i] == post) _watching.splice(i, 1);
    
    var otherPosts = localStorage.getItem(key);
    
    if (!otherPosts) return;
    
    localStorage.setItem(key, otherPosts.replace(post + ";", ""));
}
                         
function savePost(key, post)
{
    var otherPosts = localStorage.getItem(key);
    
    if (otherPosts && otherPosts.indexOf(post) !== -1) return;
    
    localStorage.setItem(key, (!otherPosts ? "" : otherPosts) + post + ";");
}

function fillInbox()
{
    var dvPosts = localStorage.getItem("DVPostsPending");
    var cvPosts = localStorage.getItem("CVPostsPending");
    var manPosts = localStorage.getItem("ManPostsPending");  
    var processPosts = function(posts, inboxItemSummary, reason)
    {
        if (!posts || posts.length == 0) return;
        
        var urls = posts.split(";");

        for (var i = 0; i < urls.length; i++)
        {
            if (!urls[i] || urls[i].length === 0) continue;
            
            var postHtml = httpGet(urls[i]);
            var title = $(".question-hyperlink", $(postHtml)).first().text();
            var active = $(".relativetime", $(postHtml)).first().text();
            addInboxItem(urls[i], active, title, inboxItemSummary, reason);
        }
    };
    
    processPosts(dvPosts, _dvPostInboxItemSummary, "dv");
    processPosts(cvPosts, _cvPostInboxItemSummary, "cv");
    processPosts(manPosts, _manPostInboxItemSummary, "man");
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
            case "man":
                // Don't remove manually added posts (use the "unwatch" btn for that).
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
    unreadCount.text(parseInt(!txt || txt.length === 0 ? "0" : txt) + 1);
}
