/*
 *  Markdown Copy
 *  Author: Giuseppe Fabiano - fabianosoftware.it
 *  License: MPL2 (Mozilla Public License, Version 2.0)
 *  The development of this add-on is funded by:
 *  Linkspirit - linkspirit.it
*/

// Mime
Cu.import("resource:///modules/gloda/mimemsg.js");
// Attachment stream
Cu.import("resource://gre/modules/Services.jsm");  
Cu.import("resource://gre/modules/NetUtil.jsm");

var result;
var attachments;

function markdownCopy(event)
{
	// Get selected message (nsIMsgDBHdr)
	var message = gFolderDisplay.selectedMessage;
	if (!message) {
		alert("No message selected!");
	}
	// Process message
	processMimeMessage(message);
}

function getMessageSource(msgHdr)
{
	var msgHdr = gFolderDisplay.selectedMessage;
	var msgUri = msgHdr.folder.getUriForMsg(msgHdr);
	var messenger = Components.classes["@mozilla.org/messenger;1"].
		createInstance(Components.interfaces.nsIMessenger);
	var msgService = messenger.messageServiceFromURI(msgUri);
	var scriptableInputStream = Components.classes["@mozilla.org/scriptableinputstream;1"].
		createInstance(Components.interfaces.nsIScriptableInputStream);
	var syncStreamListener = Components.classes["@mozilla.org/network/sync-stream-listener;1"].
		createInstance(Components.interfaces.nsISyncStreamListener);
	scriptableInputStream.init(syncStreamListener);
	var messageUri = msgService.streamMessage(msgUri, syncStreamListener, null, null, false, "", true);
	var data = new String();
	var count = scriptableInputStream.available();
	while (count) {
		data = data + scriptableInputStream.read(count);
		count = scriptableInputStream.available();
	}
	scriptableInputStream.close();
	return data;
}

function getMessageBodyAsText(msgHdr)
{
	var msgUri = msgHdr.folder.getUriForMsg(msgHdr);
	var messenger = Components.classes["@mozilla.org/messenger;1"].
		createInstance(Components.interfaces.nsIMessenger);
	var msgService = messenger.messageServiceFromURI(msgUri);
	var syncStreamListener = Components.classes["@mozilla.org/network/sync-stream-listener;1"].
		createInstance(Components.interfaces.nsISyncStreamListener);
	msgService.streamMessage(msgUri, syncStreamListener, null, null, false, "", true);
	var contentType = new Object();
	var data = msgHdr.folder.getMsgTextFromStream(
		syncStreamListener.inputStream, msgHdr.Charset, 65536, 32768, false, true, contentType);
	return data;
}

function processMimeMessage(msgHdr)
{
	MsgHdrToMimeMessage(msgHdr, null, function(msgHdr, mimeMessage) {
		result = '';
		// Parse headers
		if (mimeMessage.headers.date) {
			result += "> **Date**: " + mimeMessage.headers.date.join(", ") + "\r\n";
		}
		if (mimeMessage.headers.from) {
			result += "> **From**: " + mimeMessage.headers.from.join(", ") + "\r\n";
		}
		if (mimeMessage.headers.to) {
			result += "> **To**: " + mimeMessage.headers.to.join(", ") + "\r\n";
		}
		if (mimeMessage.headers.cc) {
			result += "> **Cc**: " + mimeMessage.headers.cc.join(", ") + "\r\n";
		}
		if (mimeMessage.headers.bcc) {
			result += "> **Bcc**: " + mimeMessage.headers.bcc.join(", ") + "\r\n";
		}
		if (mimeMessage.headers.subject) {
			result += "> **Subject**: " + mimeMessage.headers.subject.join(", ") + "\r\n";
		}
		result += "> \r\n";
		// Parse body
		var bodyText = getMessageBodyAsText(msgHdr);
		var bodyTextParts = bodyText.split("\n");
		var i;
		var addedSeparator = false;
		for (i = 0; i < bodyTextParts.length; i++) {
			var bodyTextPart = parseBodyLine("> " +bodyTextParts[i]);			
			if (bodyTextPart != ("> " +bodyTextParts[i])) {
				if (!addedSeparator) {
					result += ">---\r\n";
					addedSeparator = true;
				}
			}
			else {
				addedSeparator = false;
			}
			result += bodyTextPart.trim() + "\r\n";
		}
		// Parse attachments
		attachments = [];
		if (mimeMessage.parts) {
			for (i = 0; i < mimeMessage.parts.length; i++) {
				if (mimeMessage.parts[i].name) {
					attachments.push(mimeMessage.parts[i]);
				}
				if (mimeMessage.parts[i].parts) {
					for (var j = 0; j < mimeMessage.parts[i].parts.length; j++) {
						if (mimeMessage.parts[i].parts[j].name) {
							attachments.push(mimeMessage.parts[i].parts[j]);	
						}
					}
				}				
			}
		}
		// Calculate attachment md5
		if (attachments.length > 0) {
			for (i = 0; i < attachments.length; i++) {
				calculateAttachmentMd5(attachments[i]);
			}
		}
		else {
			processDone();
		}
	});
}

function processDone()
{
	if (attachments.length > 0) {
		for (i = 0; i < attachments.length; i++) {
			if (!attachments[i].md5) {
				// Wait for all hashes to be calculated
				return;
			}
		}
		result += "> \r\n";
		result += "> \r\n";
		result += "> **Attachments** \r\n";
		for (i = 0; i < attachments.length; i++) {
			result += "> " + (i + 1) + ". " + attachments[i].md5 + " " + attachments[i].name + "\r\n";
		}
	}
	// Copy to clipboard
	const clipboardHelper = Components.classes["@mozilla.org/widget/clipboardhelper;1"]
							.getService(Components.interfaces.nsIClipboardHelper);  
	clipboardHelper.copyString(result);	
}

function parseBodyLine(bodyLine)
{
	// EN
	bodyLine = bodyReplace(bodyLine, "> Date", "> **Date**");
	bodyLine = bodyReplace(bodyLine, "> From", "> **From**");
	bodyLine = bodyReplace(bodyLine, "> To", "> **To**");
	bodyLine = bodyReplace(bodyLine, "> Cc", "> **Cc**");
	bodyLine = bodyReplace(bodyLine, "> Bcc", "> **Bcc**");		
	bodyLine = bodyReplace(bodyLine, "> Subject", "> **Subject**");
	// IT
	bodyLine = bodyReplace(bodyLine, "> Data", "> **Date**");
	bodyLine = bodyReplace(bodyLine, "> Inviato", "> **Date**");
	bodyLine = bodyReplace(bodyLine, "> A", "> **To**");
	bodyLine = bodyReplace(bodyLine, "> Da", "> **From**");
	bodyLine = bodyReplace(bodyLine, "> Ccn", "> **Bcc** :");		
	bodyLine = bodyReplace(bodyLine, "> Oggetto", "> **Subject**");	
	// FR
	bodyLine = bodyReplace(bodyLine, "> De", "> **From**");
	bodyLine = bodyReplace(bodyLine, "> Envoyé", "> **Date**");
	bodyLine = bodyReplace(bodyLine, "> À", "> **To**");
	bodyLine = bodyReplace(bodyLine, "> Objet", "> **Subject**");

	return bodyLine;
}

function bodyReplace(line, fromText, toText)
{
	var fromChars = fromText.replace(/ /g, "");
	var lineChars = line.replace(/ /g, "");
	if (lineChars.startsWith(fromChars + ":")) {
		line = toText + line.substring(fromText.length);
	}	
	return line;
}

function calculateAttachmentMd5(mimeAttachment)
{
	let url = Services.io.newURI(mimeAttachment.url, null, null);  
	let channel = Services.io.newChannelFromURI(url);  
	let hashEngine = Components.classes["@mozilla.org/security/hash;1"]
                        .createInstance(Components.interfaces.nsICryptoHash);
	let listener = {  
		onStartRequest: function (/* nsIRequest */ aRequest, /* nsISupports */ aContext) {
			hashEngine.init(hashEngine.MD5);
		},  
		onStopRequest: function (/* nsIRequest */ aRequest, /* nsISupports */ aContext, /* int */ aStatusCode) {  
			var binHash = hashEngine.finish(false);
			var ascii = [];
			ii = binHash.length;
			for (var i = 0; i < ii; ++i) {
				var c = binHash.charCodeAt(i);
				var ones = c % 16;
				var tens = c >> 4;
				ascii.push(String.fromCharCode(tens + (tens > 9 ? 87 : 48)) +
					String.fromCharCode(ones + (ones > 9 ? 87 : 48)));
			}
			mimeAttachment.md5 = ascii.join('');
			processDone();
		},  
		onDataAvailable: function (/* nsIRequest */ aRequest, /* nsISupports */ aContext,  
			/* nsIInputStream */ aStream, /* int */ aOffset, /* int */ aCount) {  
			var data = NetUtil.readInputStreamToString(aStream, aCount);
			var dataArray = [];
			var ii = data.length;
			for (var i = 0; i < ii; ++i) {
				dataArray.push(data.charCodeAt(i));
			}
			hashEngine.update(dataArray, dataArray.length);
		},  
		QueryInterface: XPCOMUtils.generateQI([Ci.nsISupports, Ci.nsIStreamListener, Ci.nsIRequestObserver]),
	};  
	channel.asyncOpen(listener, null);
}
