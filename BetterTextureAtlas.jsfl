var included = {};
fl.include = function(file) {
	if (included[file]) { return; }
		included[file] = true;
	eval(FLfile.read(fl.configURI+"Commands/bta_src/"+file+".sjs"));
}


fl.include("SaveData");

///// CONFIGURATION

fl.outputPanel.clear(); // debug purposes

fl.showIdleMessage(false);
var symbols = [];
var meshExport = false; // If to use a spritemap or mesh vertex data
var BTA_version = "bta_1"; // easy to modify
var algorithm = "maxRects";
var onlyVisibleLayers = true;
var optimizeDimensions = true;
var optimizeJson = true;
var flattenSkewing = false;
var resolution = 1.0;
var version = SaveData.prototype.version;
var ShpPad = 0;
var BrdPad = 0;
var AllRot = true;
///// ADDITIONAL BIZZ
var inlineSym = false;
var includeSnd = true;

var bakedFilters = false; // TODO
var bakedTweens = false; // TODO: add non-baked tweens
var bakeOneFR = true;
var bakeTexts = false;
/////
var doc = fl.getDocumentDOM();
var lib = doc.library;
var path = "";

var instance = null;
var resScale = 1.0;


var profileXML=fl.getDocumentDOM().exportPublishProfileString(); 
onlyVisibleLayers = profileXML.split("<InvisibleLayer>")[1].charAt(0) == "0";

function _main()
{
	
	if (doc == null)
	{
		alert("you need to be in an document in order to export the atlas");
		return;
	}

	if (doc.selection.length > 0)
	{
		var i = 0;
		while (i < doc.selection.length)
		{
			var object = doc.selection[i];
			if (object.elementType == "instance")
				symbols.push(object.libraryItem.name);
			if (doc.selection.length == 1)
				instance = object;
			i++;
		}
	}
	else if (lib.getSelectedItems().length > 0)
	{
		var items = lib.getSelectedItems();
		while (items.length > 0)
			symbols.push(items.shift().name);
	}
	
	if (symbols.length <= 0)
	{
		alert("No symbol has been selected");
		return;
	}

	var res = 1.0;
	var optDimens = "true";
	var optAn = "true";
	var flatten = "false";

	//fl.runScript(fl.configURI + "Commands/bta_src/save.scr", "setupSaves");
	SaveData.setupSaves();

	var config = fl.configURI;

	var rawXML = fl.runScript(fl.configURI + "Commands/bta_src/save.scr", "xmlData");

	var xPan = SaveData.openXMLFromString(rawXML);

	if (xPan == null)
	{
		alert("Failed loading XML Panel");
		return;
	}
	
	if (xPan.dismiss == "cancel")
	{
		fl.trace("Operation cancelled");
		return;
	}

	var familySymbol = [];
	var frs = [];
	var curFr = doc.getTimeline().currentFrame;
	var n = "";

	while (true)
	{
		n = doc.getTimeline().name;
		doc.exitEditMode();

		if (n == doc.timelines[0].name)
			break;

		if (doc.selection[0] != undefined)
		{
			familySymbol.unshift(doc.selection[0]);
			frs.unshift(doc.getTimeline().currentFrame);
		}
	}

	ShpPad = parseInt(xPan.ShpPad);
	BrdPad = parseInt(xPan.BrdPad);
	res = xPan.ResSld;
	optDimens = xPan.OptDimens;
	optAn = xPan.OptAn;
	flatten = xPan.FlatSke;
	AllRot = xPan.Rotate;

	var dataAdd = FLfile.read(fl.configURI + "Commands/bta_src/saveADDBTA.txt");
	inlineSym = dataAdd[0];
	bakeTexts = dataAdd[1];
	includeSnd = dataAdd[2];
	bakeOneFR = dataAdd[3];
	
	var fileuri = xPan.saveBox;
	if (doc.path != null)
	{
		var docarr = doc.path.split("\\");
		docarr.pop();
		if (fileuri.split("C:\\")[0] != "")
			fileuri = docarr.join("\\") + "\\" + fileuri;
	}

	optimizeDimensions = (optDimens == "true");
	optimizeJson = (optAn == "true");
	flattenSkewing = (flatten == "true");
	resolution = parseFloat(res);
	resScale =  1 / resolution;

	// Reduce if statements
	key = optimizeJson ? function (a, b) {return b} : function (a, b) {return a};

	// First ask for the export folder
	path = formatPath(fileuri);

	FLfile.createFolder(path);
	exportAtlas(path, symbols);

	var saveArray = fileuri.split("\\");
	saveArray.pop();
	var savePath = saveArray.join("\\");

	initJson();

	for (i = 0; i < familySymbol.length; i++)
	{
		doc.getTimeline().currentFrame = frs[i];
		familySymbol[i].selected = true;
		doc.enterEditMode("inPlace");
	}

	doc.getTimeline().currentFrame = curFr;

	fl.trace("DONE");
	fl.showIdleMessage(true);
}

_main();
var SPRITEMAP_ID;
var TEMP_SPRITEMAP;
var TEMP_ITEM;
var TEMP_TIMELINE;
var TEMP_LAYER;
var smIndex;

var frameQueue;
var dictionary;

var ogSym;

function exportAtlas(exportPath, symbolNames)
{
	SPRITEMAP_ID = "__BTA_TEMP_SPRITEMAP_";
	TEMP_SPRITEMAP = SPRITEMAP_ID + "0";
	frameQueue = [];
	smIndex = 0;

	dictionary = [];

	var tmpSymbol = false;
	var symbol;

	if (symbolNames.length == 1)
	{
		symbol = findItem(symbolNames[0]);
	}
	else
	{
		var containerID = SPRITEMAP_ID + "PACKED_SYMBOL";
		lib.addNewItem("graphic", containerID);
		lib.editItem(containerID);

		tmpSymbol = true;
		symbol = findItem(containerID);

		var i = 0;
		var startIndex = 0;

		while(i < symbolNames.length)
		{
			var tempName = symbolNames[i];
			var frameCount = findItem(tempName).timeline.frameCount - 1;

			var startFrame = symbol.timeline.layers[0].frames[startIndex];
			startFrame.name = tempName;
			startFrame.labelType = "name";

			symbol.timeline.insertFrames(frameCount, false, startIndex);
			symbol.timeline.currentFrame = startIndex;
			lib.addItemToDocument({x: 0, y: 0}, tempName);

			startIndex += frameCount;
			i++;

			if (i <= symbolNames.length)
				symbol.timeline.insertBlankKeyframe(startIndex);
		}
	}

	lib.addNewItem("graphic", TEMP_SPRITEMAP);
	TEMP_ITEM = findItem(TEMP_SPRITEMAP);
	TEMP_TIMELINE = TEMP_ITEM.timeline;
	TEMP_LAYER = TEMP_TIMELINE.layers[0];
	TEMP_TIMELINE.removeFrames(0,0);

	ogSym = symbol;

	//measure(function () {

	// Write Animation.json
	FLfile.write(path + "/Animation.json", generateAnimation(symbol));

	// Add items and fix resolutions
	var editedQueue = false;
	var pos = {x:0, y:0};

	var i = 0;
	while (i < frameQueue.length)
	{
		var queuedFrame = frameQueue[i].split("_");
		var type = queuedFrame.shift();
		var id = queuedFrame.join("");

		if (type == "ITEM") // Push the item frame
		{
			if (!editedQueue)
			{
				editedQueue = true;
				lib.editItem(TEMP_SPRITEMAP);
			}

			TEMP_TIMELINE.currentFrame = i;
			lib.addItemToDocument(pos, id);
			
			// TODO: only do resolution < 1 if its a bitmap item
			if (resolution < 1) {
				var item = TEMP_LAYER.frames[i].elements[0];
				item.scaleX = item.scaleY = resolution;
			}
		}
		else // TODO: do some lines to fills crap here for changing resolutions
		{

		}

		i++;
	}

	if (editedQueue)
		doc.exitEditMode();

	//});

	// Generate Spritemap
	var sm = makeSpritemap();
	sm.addSymbol(TEMP_ITEM);

	var smData = {sm: sm, index:0};
	spritemaps = [smData];

	// Divide Spritemap if overflowed
	if (sm.overflowed) {
		divideSpritemap(smData, TEMP_ITEM);
	}

	var i = 0;
	while (i < spritemaps.length) {
		var id = SPRITEMAP_ID + i;
		var exportId = (i == 0) ? 1 : Math.abs(i - spritemaps.length - 1);

		exportSpritemap(id, exportPath, spritemaps[i++], exportId);
		lib.deleteItem(id);
	}

	if (tmpSymbol)
		lib.deleteItem(symbol.name);

	fl.trace("Exported to folder: " + exportPath);
}

var spritemaps;

function divideSpritemap(smData, symbol)
{
	var parent = smData.sm;
	var framesLength = symbol.timeline.layers[0].frames.length;
	var cutFrames = Math.floor(framesLength * 0.5);

	var nextSmID = SPRITEMAP_ID + spritemaps.length;
	lib.addNewItem("graphic", nextSmID);
	var nextSmSymbol = findItem(nextSmID);

	symbol.timeline.copyFrames(cutFrames, framesLength);
	nextSmSymbol.timeline.pasteFrames(0, (framesLength - cutFrames));
	symbol.timeline.removeFrames(cutFrames, framesLength);

	var nextSm = makeSpritemap();
	var nextSmData = {sm: nextSm, index: cutFrames + smData.index};
	spritemaps.push(nextSmData);
	nextSm.addSymbol(nextSmSymbol);

	parent.removeSymbol(symbol);
	parent.addSymbol(symbol);

	if (parent.overflowed) {
		divideSpritemap(smData, symbol);
	}

	if (nextSm.overflowed) {
		divideSpritemap(nextSmData, nextSmSymbol);
	}
}

function exportSpritemap(id, exportPath, smData, index)
{
	var smPath = exportPath + "/spritemap" + index;
	var smSettings = {format:"png", bitDepth:32, backgroundColor:"#00000000"};
	var sm = smData.sm;
	sm.exportSpriteSheet(smPath, smSettings, true);

	if (optimizeDimensions) for (__ = 0; __ < 2; __++) // TODO: figure out a better way to double-check trimmed resolutions
	{
		var smWidth = 1;
		var smHeight = 1;

		var meta = FLfile.read(smPath + ".json").split("\t").join("").split(" ").join("");
		var atlasLimbs = meta.split(id);
		atlasLimbs.splice(0, 1);

		var i = 0;
		var l = atlasLimbs.length;
		while (i < l)
		{
			var limbData = atlasLimbs[i++].split("{").join("").split("}").join("").split("\n");
			var splitFrame = limbData[1].substring(8).split(",");

			var x = parseInt(splitFrame[0].substring(4));
			var y = parseInt(splitFrame[1].substring(4));
			var w = parseInt(splitFrame[2].substring(4));
			var h = parseInt(splitFrame[3].substring(4));

			smWidth = Math.max(smWidth, x + w);
			smHeight = Math.max(smHeight, y + h);
		}

		sm.autoSize = false;
		sm.sheetWidth = smWidth + BrdPad;
		sm.sheetHeight = smHeight + BrdPad;
		
		if (sm.overflowed)
		{
			break;
		}
		else
		{
			sm.exportSpriteSheet(smPath, smSettings, true);
		}
	}

	// Parse and change json to spritemap format
	var meta = FLfile.read(smPath + ".json").split("\t").join("").split(" ").join("");
	var atlasLimbs = meta.split(id);
	atlasLimbs.splice(0, 1);

	var smJson = ['{"ATLAS":{"SPRITES":[\n'];

	var l = 0;
	while (l < atlasLimbs.length)
	{
		var limbData = atlasLimbs[l].split("\n");

		var name = parseInt(formatLimbName(limbData[0].slice(0, -2))) + smData.index;
		var frame = limbData[1].substring(9, limbData[1].length - 2);
		var rotated = limbData[2].slice(0, -1);

		smJson.push('{"SPRITE":{"name":"' +  name + '",' + frame + ',' + rotated + '}}');
		if (l < atlasLimbs.length - 1) smJson.push(',\n');
		l++;
	}

	smJson.push(']},\n"meta":');

	var metaData = atlasLimbs.pop().split('"meta":')[1];
	metaData = metaData.split(sm.app.split(" ").join("")).join(sm.app + " (Better TA Extension)");
	smJson.push(metaData.split("scale").join("resolution").slice(0, -1));

	FLfile.write(smPath + ".json", smJson.join(""));
}

function makeSpritemap() {
	var sm = new SpriteSheetExporter;
	sm.algorithm = algorithm;
	sm.autoSize = true;
	sm.borderPadding = BrdPad;
	sm.shapePadding = ShpPad;
	sm.allowRotate = AllRot;
	sm.allowTrimming = true;
	sm.stackDuplicate = true;
	sm.layoutFormat = "JSON-Array";
	return sm;
}

function generateAnimation(symbol)
{
	initJson();
	push("{\n");

	// Add Animation
	jsonHeader(key("ANIMATION", "AN"));
	jsonStr(key("name", "N"), doc.name.split(".fla").join(""));

	if (instance != null) {
		jsonHeader(key("StageInstance", "STI"));
		parseSymbolInstance(instance);
		push('},\n');
	}

	jsonStr(key("SYMBOL_name", "SN"), symbol.name);
	jsonHeader(key("TIMELINE", "TL"));
	parseSymbol(symbol);
	push('},\n');

	// Add Symbol Dictionary
	if (dictionary.length > 0)
	{
		if (inlineSym)
		{
			jsonHeader(key("SYMBOL_DICTIONARY", "SD"));
			jsonArray(key ("Symbols", "S"));

			var dictIndex = 0;
			while (dictIndex < dictionary.length)
			{
				var symbol = findItem(dictionary[dictIndex++]);
				push('{\n');
				jsonStr(key("SYMBOL_name", "SN"), symbol.name);
				jsonHeader(key("TIMELINE", "TL"));
				parseSymbol(symbol);
				push('},');
			}

			removeTrail(1);
			push(']},\n');
		}
		else
		{
			FLfile.createFolder(path + "/LIBRARY");

			var dictIndex = 0;
			while (dictIndex < dictionary.length)
			{
				initJson();
				push("{");
				push(parseSymbol(findItem(dictionary[dictIndex++]) ));
				
				var pathDict = dictionary[dictIndex - 1].split("/");
				var foldI = 0;
				
				
				var folderStuff = "";
				while (foldI < pathDict.length - 1)
				{
					if (folderStuff != "") folderStuff += "/";
					folderStuff += pathDict[foldI];
					FLfile.createFolder(path + "/LIBRARY/" + folderStuff);
					
					foldI++;
				}
				
	
				FLfile.write(path + "/LIBRARY/" + dictionary[dictIndex - 1] + ".json", closeJson());
			}
		}
	}

	// Add Metadata
	if (inlineSym)
	{
		jsonHeader(key("metadata", "MD"));
		metadata();
		push('}}');
	}
	else
	{
		removeTrail(2);
		push("}");

		initJson();

		push("{\n");
		metadata();
		push("}\n");

		FLfile.write(path + "/metadata.json", closeJson());
	}

	return closeJson();
}

function metadata()
{
	jsonStr(key("version", "V"), BTA_version);
	jsonVarEnd(key("framerate", "FRT"), doc.frameRate);
}

function parseSymbol(symbol)
{
	var timeline = symbol.timeline;
	var layers = timeline.layers;

	jsonArray(key("LAYERS", "L"));

	// TODO: rework this into bake shape layers
	if (bakeOneFR && symbol != ogSym && timeline.frameCount == 1)
	{
		push('{');
		jsonStr(key("Layer_name", "LN"), "Layer 1");
		jsonArray(key("Frames", "FR"));
		push('{');
		jsonVar(key("index", "I"), 0);
		jsonVar(key("duration", "DU"), 1);
		jsonArray(key("elements", "E"));
		push('{');
		pushItemSpritemap(symbol);
		push('}]}]}]}');
		return;
	}

	var l = 0;
	var ll = layers.length;
	while (l < ll)
	{
		var layer = layers[l];
		if (layer.visible || !onlyVisibleLayers)
		{
			var lockedLayer = layer.locked;
			layer.locked = false;

			push('{\n');
			jsonStr(key("Layer_name", "LN"), layer.name);

			switch (layer.layerType)
			{
				case "mask":
					jsonStr(key("Layer_type", "LT"), key("Clipper", "Clp"));
				if (layer.parentLayer != undefined)
						jsonStr(key("Parent_layer", "PL"), layer.parentLayer.name);
				break;
				case "masked":
					jsonStr(key("Clipped_by", "Clpb"), layer.parentLayer.name);

				break;
				case "folder":
					
					if (layer.parentLayer != undefined)
					{
						jsonStr(key("Layer_type", "LT"), key("Folder", "Fld"));
						jsonStrEnd(key("Parent_layer", "PL"), layer.parentLayer.name);
					}
					else
						jsonStrEnd(key("Layer_type", "LT"), key("Folder", "Fld"));
				break;
				// not planning on adding these
				case "guide":
				case "guided":
				case "normal":
					if (layer.parentLayer != undefined)
						jsonStr(key("Parent_layer", "PL"), layer.parentLayer.name);
				break;
			}

			if (layer.layerType != "folder")
				parseFrames(layer.frames, l, timeline);

			push('},');

			layer.locked = lockedLayer;
		}
		l++;
	}

	removeTrail(1);
	push(']}');
}

function parseFrames(frames, layerIndex, timeline)
{
	jsonArray(key("Frames", "FR"));

	var f = 0;
	var fr = frames.length;
	while (f < fr)
	{
		var frame = frames[f];
		var pushFrame = (f == frame.startFrame);

		if (frame.tweenType != "none")
		{
		}

		if (pushFrame)
		{
			push('{\n');

			if (frame.name.length > 0)
				jsonStr(key("name", "N"), frame.name);

			if (frame.tweenType != "none")
			{
				jsonHeader(key("tween", "TWN"));

				var isCubic = frame.getCustomEase() != null;

				if (isCubic)
				{	
					// FLfile.createFolder(path + "/LIBRARY");
					jsonArray(key("curve", "CV"));
					var eases = frame.getCustomEase();
					for (var i = 0; i < eases.length; i++)
					{
						var field = eases[i];
						push("{");
						jsonVar("x", field.x);
						jsonVarEnd("y", field.y);
						push("},\n");
					}

					removeTrail(2);

					push("],\n");
					// var oldJSON = curJson;
					// initJson();
					
					// push("{\n");


					// FLfile.write(path + "/LIBRARY/eases.json", );
				}
				else
				{
					jsonVar(key("ease", "ES"), frame.tweenEasing);
				}
				
				switch (frame.tweenType)
				{
					case "motion": // "classic"
					jsonStr(key("type", "T"), key("motion", "MT"));
					jsonStr(key("rotate", "RT"), frame.motionTweenRotate);
					jsonVar(key("rotateTimes", "RTT"), frame.motionTweenRotateTimes);
					jsonVar(key("scale", "SL"), frame.motionTweenScale);
					jsonVar(key("snap", "SP"), frame.motionTweenSnap);
					jsonVarEnd(key("sync", "SC"), frame.motionTweenSync);

					break;
					case "motion object":
					jsonStr(key("type", "T"), key("motion_OBJECT", "MTO"));
					parseMotionObject(xmlToObject(frame.getMotionObjectXML()));
					
					break;
					case "shape":
					jsonStr(key("type", "T"), key("shape", "SHP"));

					break;
				}	

				push("},\n");
			}

			if (includeSnd && frame.soundLibraryItem != null)
			{
				FLfile.createFolder(path + "/LIBRARY");
				var ext = ".mp3";
				if (frame.soundLibraryItem.originalCompressionType == "RAW")
					ext = ".wav";
				frame.soundLibraryItem.exportToFile(path + "/LIBRARY/" + frame.soundLibraryItem.name + ext);
				jsonHeader(key("Sound", "SND"));

				jsonStr(key("name", "N"), frame.soundLibraryItem.name + ext);
				jsonStr(key("Sync", "SNC"), frame.soundSync);
				jsonStr(key("Loop", "LP"), frame.soundLoopMode);
				
				if (frame.soundLoopMode == "repeat")
					jsonVarEnd(key("Repeat", "RP"), frame.soundLoop);
				else
					removeTrail(1);
				push('},\n');
			}

			jsonVar(key("index", "I"), f);
			jsonVar(key("duration", "DU"), frame.duration);
			parseElements(frame.elements, f, layerIndex, timeline);
			push('},');
		}
		f++;
	}

	removeTrail(1);
	push(']');
}

// This is what pain looks like
// I hope adobe burns to the ground for only allowing this data as a xml
function parseMotionObject(motionData)
{
	// Time Map
	var timemap = motionData.TimeMap;
	jsonHeader(key("timeMap", "TM"));
	jsonVar(key("strength", "S"), timemap.strength);
	jsonStrEnd(key("type", "T"), timemap.type);
	push("},\n");

	// Property Container
	var propCont = motionData.PropertyContainer.PropertyContainer;
	jsonArray(key("propertyContainer", "PC"));

	var c = 0;
	while (c < propCont.length)
	{
		// only output changed containers
		var cont = propCont[c++];
		if (cont.Property == undefined)
			continue;

		push("{\n");
		jsonStr("id", cont.id);
		jsonArray(key("properties", "P"));

		var p = 0;
		while (p < cont.Property.length)
		{
			// only output changed properties
			var prop = cont.Property[p++];
			if (!isArray(prop.Keyframe))
				continue;

			push("{\n");
			jsonStr("ID", prop.id);
			jsonArray(key("Keyframes", "KFR"));

			var kf = 0;
			while (kf < prop.Keyframe.length)
			{
				var keyframe = prop.Keyframe[kf++];
				push("{\n");
				jsonVar(key("anchor", "ANC"), "[" + keyframe.anchor + "]");
				jsonVar(key("next", "NXT"), "[" + keyframe.next + "]");
				jsonVar(key("previous", "PRV"), "[" + keyframe.previous + "]");
				jsonVarEnd(key("index", "I"), keyframe.timevalue * 0.001);
				push("},");
			}

			removeTrail(1);
			push("]},");
		}

		removeTrail(1);
		push("]},");
	}
	
	removeTrail(1);
	push("]\n");
}

function parseElements(elements, frameIndex, layerIndex, timeline)
{
	jsonArray(key("elements", "E"));

	var e = 0;
	var el = elements.length;
	var shapeQueue = [];

	while (e < el)
	{
		var element = elements[e];
		var elementType = element.elementType;
		var isShape = (elementType == "shape") ? !element.isGroup : false;
		
		if (isShape) // Adobe sometimes forgets how their own software works
		{
			shapeQueue.push(e);
		}
		else
		{
			if (shapeQueue.length > 0)
			{
				push("{");
				parseShape(timeline, layerIndex, frameIndex, shapeQueue, true)
				push("},\n");
				shapeQueue = [];
			}

			push("{");
		}

		switch (element.elementType)
		{
			case "shape":
				if (element.isGroup)
					parseShape(timeline, layerIndex, frameIndex, [e], false);
			break;
			case "instance":
				switch (element.instanceType) {
					case "symbol":
					if (bakedFilters && (element.filters != undefined && element.filters.length > 0))
						parseShape(timeline, layerIndex, frameIndex, [e], true);
					else
						parseSymbolInstance(element);
					break;
					case "bitmap":
						parseBitmapInstance(element);
					break;
					// TODO: add missing element instance types
					case "embedded video": break;
					case "linked video": break;
					case "video": break;
					case "compiled clip": break;
				}
			break;
			case "text":
				switch (element.textType)
				{
					case "static": // TODO: add missing text types
					case "dynamic": 
					case "input": 
						fl.trace(element.useDeviceFonts);
						if (!element.useDeviceFonts || bakeTexts)
							parseShape(timeline, layerIndex, frameIndex, [e], false);
						else
							parseTextInstance(element);
					break;
				}
			break;
			// TODO: add missing (deprecated) element types
			case "tlfText": 	break;
			case "shapeObj": 	break;
		}

		if (!isShape)
			push((e < elements.length -1) ? "},\n" : "}");

		e++;
	}

	if (shapeQueue.length > 0) {
		push("{");
		parseShape(timeline, layerIndex, frameIndex, shapeQueue, true)
		push("}");
	}

	push(']');
}

function parseTextInstance(text)
{
	jsonHeader(key("textFIELD_Instance", "TFI"));
	jsonStr(key("text", "TXT"), text.getTextString());
	jsonStr(key("type", "T"), text.textType);
	if (text.textType != "static")
		jsonStr(key("Instance_name", "IN"), text.name);

	var orientation = "";

	switch (text.orientation)
	{
		case "horizontal":
		orientation = key("horizontal", "HR");
		break;
		case "vertical left to right":
			orientation = key("vertical right to left", "VLTR");
		break;
		case "vertical right to left":

		orientation = key("vertical right to left", "VRTL");
		break;
	}

	jsonStr(key("orientation", "ORT"), orientation);

	var linetype = "";

	if (text.textType != "static")
	{
		switch (text.lineType)
		{
			case "single line":
				linetype = key("single line", "SL");
			break;
			case "multiline":
				linetype = key("multiline", "ML");
			break;
			case "multiline no wrap":

				linetype = key("multiline no wrap", "MLN");
			break;
			case "password":

				linetype = key("password", "PSW");
			break;
		}
	}

	jsonStr(key("lineType", "LT"), linetype);	
	jsonArray(key("attributes", "ATR"));
	
	var t = 0;
	var index = 0;
	while (t < text.textRuns.length)
	{
		push("{\n");
		var run = text.textRuns[t++];

		jsonVar(key("offset", "OF"), index);
		jsonVar(key("length", "LEN"), run.characters.length);
		jsonVar(key("alias", "ALS"), run.textAttrs.aliasText);
		jsonStr(key("align", "ALN"), run.textAttrs.alignment);
		jsonVar(key("autoKern", "AUK"), run.textAttrs.autoKern);
		jsonVar(key("bold", "BL"), run.textAttrs.bold);
		jsonVar(key("italic", "IT"), run.textAttrs.italic);
		jsonStr(key("charPosition", "CPS"), run.textAttrs.characterPosition);
		jsonVar(key("charSpacing", "CSP"), run.textAttrs.characterSpacing);
		jsonVar(key("lineSpacing", "LSP"), run.textAttrs.lineSpacing);
		jsonStr(key("font", "F"), run.textAttrs.face);
		jsonVar(key("Size", "SZ"), run.textAttrs.size);
		jsonStr(key("color", "C"), run.textAttrs.fillColor);
		jsonStr(key("indent", "IND"), run.textAttrs.indent);
		jsonVar(key("leftMargin", "LFM"), run.textAttrs.leftMargin);
		jsonVar(key("rightMargin", "RFM"), run.textAttrs.rightMargin);
		jsonStrEnd("URL", run.textAttrs.url);
		
		index += run.characters.length;

		push("},\n");
	}

	removeTrail(2);
	push("],\n");

	jsonVar(key("border", "BRD"), text.border);
	jsonVar(key("alias_SHARPNESS", "ALSRP"), text.antiAliasSharpness);
	jsonVar(key("alias_thickness", "ALTHK"), text.antiAliasThickness);
	jsonVarEnd("MAX", text.maxCharacters);

	push("}\n");
}

function parseBitmapInstance(bitmap)
{
	var m = bitmap.matrix;
	var matrix = {a:m.a, b:m.b, c:m.c, d:m.d, tx:m.tx, ty:m.ty};

	if (resolution < 1) {
		matrix.a *= resScale;
		matrix.d *= resScale;
	}

	var itemIndex = pushItemSpritemap(bitmap.libraryItem);
	parseAtlasInstance(matrix, itemIndex);
}

function parseShape(timeline, layerIndex, frameIndex, elementIndices, checkMatrix)
{
	var shapes = pushElementSpritemap(timeline, layerIndex, frameIndex, elementIndices);
	var shape = shapes[0];
	var mtx;
	
	

	if (checkMatrix)
	{
		var minX = shape.x;
		var minY = shape.y;
		var maxX = shape.width;
		var maxY = shape.height;
		

		var s = 1;
		while (s < shapes.length)
		{
			var shape = shapes[s];
			minX = Math.min(minX, shape.x);
        	minY = Math.min(minY, shape.y);
        	maxX = Math.max(maxX, shape.width);
        	maxY = Math.max(maxY, shape.height);
			s++;
		}
		

		var transformingX = (minX - (rShape(maxX * 0.5)));
		var transformingY = (minY - (rShape(maxY * 0.5)));
		
		// var tx = Math.round();

		mtx = {a: resScale, b: 0, c: 0, d: resScale, tx: transformingX, ty: transformingY}
	}
	else
	{
		mtx = cloneMatrix(shape.matrix);
		mtx.a *= resScale;
		mtx.d *= resScale;
	}

	parseAtlasInstance(mtx, smIndex - 1);
}

function rShape(value)
{
	var v = value.toFixed(3);

	if (Math.floor(v) == v)
		return v;
	
	v *= 10;
	
	var tV = Math.floor(v);

	v -= tV;
	
	var r = Math.round(v);
	if (r == 0)
		v = 0;
	if (v == 1)
		v = 0.5;

	v *= 0.1;
	v += tV * 0.1;

	return v.toFixed(3);

}

function parseAtlasInstance(matrix, name)
{
	jsonHeader(key("ATLAS_SPRITE_instance", "ASI"));
	jsonVar(key("Matrix", "MX"), parseMatrix(matrix));
	jsonStrEnd(key("name", "N"), name);
	push('}');
}

function pushFrameSpritemap(timeline)
{
	timeline.setSelectedLayers(0, true);
	timeline.copyFrames(0, 0);
	TEMP_TIMELINE.pasteFrames(smIndex);
	frameQueue.push("ELEMENT_" + smIndex);	

	var e = 0;
	var elements = TEMP_LAYER.frames[smIndex].elements;
	while (e < elements.length)
	{
		var item = elements[e++];
		item.width = Math.round(item.width * resolution);
		item.height = Math.round(item.height * resolution);
	}

	var matrix = {a:resScale, b:0., c:0., d:resScale, tx: 0, ty: 0};
	parseAtlasInstance(matrix, smIndex);
	smIndex++;
}

function pushItemSpritemap(item)
{
	var name = "ITEM_" + item.name;
	var index = frameQueue.indexOf(name);

	if (index == -1) {
		TEMP_TIMELINE.insertBlankKeyframe(smIndex);
		frameQueue.push(name);
		smIndex++;
		return frameQueue.length - 1;
	}

	return index;
}

function pushElementSpritemap(timeline, layerIndex, frameIndex, elementIndices)
{
	timeline.setSelectedLayers(layerIndex, true);
	timeline.copyFrames(frameIndex, frameIndex);
	TEMP_TIMELINE.pasteFrames(smIndex);

	var frameElements = TEMP_LAYER.frames[smIndex].elements;
	var shape = frameElements[elementIndices[0]];
	var shapes = [];

	var e = 0;
	var ei = 0;
	var lastWidth = -1;

	while (e < frameElements.length)
	{
		var frameElement = frameElements[e];

		if (elementIndices[ei] == e) // Add the actual parts of the array
		{
			ei++;

			// TODO: move this to the frameQueue and fix the resolution lines bug
			// Gotta check because its both the same shape instance but also not?? Really weird shit
			if (Math.round(frameElement.width * resolution) != lastWidth)
			{
				// Gotta do this because jsfl scripts cant keep track well of instances data and will randomly corrupt values
				shapes.push({
					x: frameElement.x,
					y: frameElement.y,
					width: frameElement.width,
					height: frameElement.height,
					matrix: frameElement.matrix
				});

				frameElement.matrix = matrixIdent(frameElement.matrix);
				var roundWidth = Math.round(frameElement.width * resolution);
				
				frameElement.width = roundWidth;
				frameElement.height = Math.round(frameElement.height * resolution);
				lastWidth = roundWidth;
			}
		}
		else // Remove other crap from the frame
		{
			frameElement.width = frameElement.height = 0;
			frameElement.x = Math.round(shape.x);
			frameElement.y = Math.round(shape.y);
		}

		e++;
	}

	frameQueue.push("ELEMENT_" + smIndex);
	smIndex++;

	return shapes;
}

function parseSymbolInstance(instance)
{
	jsonHeader(key("SYMBOL_Instance", "SI"));
	var item = instance.libraryItem;

	if (item != undefined) {
		jsonStr(key("SYMBOL_name", "SN"), item.name);
		if (dictionary.indexOf(item.name) == -1)
			dictionary.push(item.name);
	}

	if (instance.firstFrame != undefined)
		jsonVar(key("firstFrame", "FF"), instance.firstFrame);

	if (instance.symbolType != undefined) {
		var type;
		switch (instance.symbolType) {
			case "graphic": 	type = key("graphic", "G"); 	break
			case "movie clip": 	type = key("movieclip", "MC"); 	break;
			case "button": 		type = key("button", "B"); 		break;
		}
		jsonStr(key("symbolType", "ST"), type);
	}

	jsonVar(key("transformationPoint", "TRP"),
		'{"x":' + instance.transformX +
		',"y":' + instance.transformY + "}"
	);

	if (instance.colorMode != "none") {
		jsonHeader(key("color", "C"));
		var modeKey = key("mode", "M");

		switch (instance.colorMode) {
			case "brightness":
				jsonStr(modeKey, key("Brightness", "CBRT"));
				jsonVarEnd(key("brightness", "BRT"), instance.brightness);
			break;
			case "tint":
				jsonStr(modeKey, key("Tint", "T"));
				jsonStr(key("tintColor", "TC"), instance.tintColor);
				jsonVarEnd(key("tintMultiplier", "TM"), instance.tintPercent * 0.01);
			break;
			case "alpha":
				jsonStr(modeKey, key("Alpha", "CA"));
				jsonVarEnd(key("alphaMultiplier", "AM"), instance.colorAlphaPercent * 0.01);
			break;
			case "advanced":
				jsonStr(modeKey, key("Advanced", "AD"));
				jsonVar(key("RedMultiplier", "RM"), instance.colorRedPercent * 0.01);
				jsonVar(key("greenMultiplier", "GM"), instance.colorGreenPercent * 0.01);
				jsonVar(key("blueMultiplier", "BM"), instance.colorBluePercent * 0.01);
				jsonVar(key("alphaMultiplier", "AM"), instance.colorAlphaPercent * 0.01);
				jsonVar(key("redOffset", "RO"), instance.colorRedAmount);
				jsonVar(key("greenOffset", "GO"), instance.colorGreenAmount);
				jsonVar(key("blueOffset", "BO"), instance.colorBlueAmount);
				jsonVarEnd(key("AlphaOffset", "AO"), instance.colorAlphaAmount);
			break;
		}

		push('},\n');
	}

	if (instance.name.length > 0)
		jsonStr(key("Instance_Name", "IN"), instance.name);

	if (instance.loop != undefined) {
		var loop;
		switch (instance.loop) {
			case "play once": 		loop = key("playonce", "PO"); 		break;
			case "single frame":	loop = key("singleframe", "SF");	break;
			case "loop": 			loop = key("loop", "LP");			break;
		}
		jsonStr(key("loop", "LP"), loop);
	}

	if (instance.is3D)	jsonVar(key("Matrix3D", "M3D"), parseMatrix3D(instance.matrix3D));
	else				jsonVar(key("Matrix", "MX"), 	parseMatrix(instance.matrix));

	if (instance.symbolType != "graphic")
	{
		if (instance.blendMode != "normal")
			jsonStr(key("blend", "B"), instance.blendMode);

		var filters = instance.filters;
		var hasFilters = (filters != undefined && filters.length > 0)

		// Add Filters
		if (hasFilters)
		{
			if (!bakedFilters)
			{
				jsonArray(key("filters", "F"));
				var n = key("name", "N");

				var i = 0;
				while (i < filters.length)
				{
					var filter = filters[i];

					push('{\n');

					switch (filter.name) {
						case "adjustColorFilter":
							jsonStr(n, key("adjustColorFilter", "ACF"));
							jsonVar(key("brightness", "BRT"), filter.brightness);
							jsonVar(key("hue", "H"), filter.hue);
							jsonVar(key("contrast", "CT"), filter.contrast);
							jsonVarEnd(key("saturation", "SAT"), filter.saturation);
						break;
						case "bevelFilter":
							jsonStr(n, key("bevelFilter", "BF"));
							jsonVar(key("blurX", "BLX"), filter.blurX);
							jsonVar(key("blurY", "BLY"), filter.blurY);
							jsonVar(key("distance", "D"), filter.distance);
							jsonVar(key("knockout", "KK"), filter.knockout);
							jsonStr(key("type", "T"), filter.type);
							jsonVar(key("strength", "STR"), filter.strength);
							jsonVar(key("angle", "A"), filter.angle);
							jsonStr(key("shadowColor", "SC"), filter.shadowColor);
							jsonStr(key("highlightColor", "HC"), filter.highlightColor);
							jsonVarEnd(key("quality", "Q"), parseQuality(filter.quality));
						break;
						case "blurFilter":
							jsonStr(n, key("blurFilter", "BLF"));
							jsonVar(key("blurX", "BLX"), filter.blurX);
							jsonVar(key("blurY", "BLY"), filter.blurY);
							jsonVarEnd(key("quality", "Q"), parseQuality(filter.quality));
						break;
						case "dropShadowFilter":
							jsonStr(n, key("dropShadowFilter", "DSF"));
							jsonVar(key("blurX", "BLX"), filter.blurX);
							jsonVar(key("blurY", "BLY"), filter.blurY);
							jsonVar(key("distance", "D"), filter.distance);
							jsonVar(key("knockout", "KK"), filter.knockout);
							jsonVar(key("inner", "IN"), filter.inner);
							jsonVar(key("hideObject", "HO"), filter.hideObject);
							jsonVar(key("strength", "STR"), filter.strength);
							jsonVar(key("angle", "A"), filter.angle);
							jsonStr(key("color", "C"), filter.color);
							jsonVarEnd(key("quality", "Q"), parseQuality(filter.quality));
						break;
						case "glowFilter":
							jsonStr(n, key("glowFilter", "GF"));
							jsonVar(key("blurX", "BLX"), filter.blurX);
							jsonVar(key("blurY", "BLY"), filter.blurY);
							jsonVar(key("inner", "IN"), filter.inner);
							jsonVar(key("knockout", "KK"), filter.knockout);
							jsonVar(key("strength", "STR"), filter.strength);
							jsonStr(key("color", "C"), filter.color);
							jsonVarEnd(key("quality", "Q"), parseQuality(filter.quality));
						break;
						case "gradientBevelFilter":
							jsonStr(n, key("gradientBevelFilter", "GBF"));
							jsonVar(key("blurX", "BLX"), filter.blurX);
							jsonVar(key("blurY", "BLY"), filter.blurY);
							jsonVar(key("distance", "D"), filter.distance);
							jsonVar(key("knockout", "KK"), filter.knockout);
							jsonStr(key("type", "T"), filter.type);
							jsonVar(key("strength", "STR"), filter.strength);
							jsonVar(key("angle", "A"), filter.angle);
							jsonVar(key("colorArray", "CA"), parseArray(filter.colorArray));
							jsonVarEnd(key("quality", "Q"), parseQuality(filter.quality));
						break;
						case "gradientGlowFilter":
							jsonStr(n, key("gradientGlowFilter", "GGF"));
							jsonVar(key("blurX", "BLX"), filter.blurX);
							jsonVar(key("blurY", "BLY"), filter.blurY);
							jsonVar(key("inner", "IN"), filter.inner);
							jsonVar(key("knockout", "KK"), filter.knockout);
							jsonVar(key("strength", "STR"), filter.strength);
							jsonVar(key("colorArray", "CA"), parseArray(filter.colorArray));
							jsonVarEnd(key("quality", "Q"), parseQuality(filter.quality));
						break;
					}

					push((i < filters.length - 1) ? '},' : '}\n');
					i++;
				}

				push(']\n');
			}
			else
			{

			}
		}
		else removeTrail(2);
	}
	else removeTrail(2);

	push('}');
}

function matrixIdent(mat)
{
	mat.a = mat.d = 1;
	mat.b = mat.c = mat.tx = mat.ty = 0;
	return mat;
}

function cloneMatrix(mat)
{
	return {a: mat.a, b: mat.b, c: mat.c, d: mat.d, tx: mat.tx, ty: mat.ty}
}

function parseMatrix(m) {
	return "[" +
	m.a + "," +
	m.b + "," +
	m.c + "," +
	m.d + "," +
	m.tx + "," +
	m.ty +
	"]";
}

function parseMatrix3D(m) {
	return "[" +
	m.m00 + "," +
	m.m01 + "," +
	m.m02 + "," +
	m.m03 + "," +
	m.m10 + "," +
	m.m11 + "," +
	m.m12 + "," +
	m.m13 + "," +
	m.m20 + "," +
	m.m21 + "," +
	m.m22 + "," +
	m.m23 + "," +
	m.m30 + "," +
	m.m31 + "," +
	m.m32 + "," +
	m.m33 +
	"]";
}

function parseArray(array) {
	return '["' + array.join('","') +'"]';
}

function parseQuality(quality) {
	if (quality == "low") return 1;
	if (quality == "medium") return 2;
	return 3;
}

function formatLimbName(numStr) {
    var i = 0;
    while (i < numStr.length && numStr[i] === '0') {
        i++;
    }
    return i === numStr.length ? "0" : numStr.slice(i);
}

function formatPath(path)
{
	// All good here im gonna assume
	if (path.split("file:///").length > 1) {
		return path;
	}

	var arr = path.split("\\");

	arr = arr.join("\\").split(":");

	path = "file:///" + arr.join("|");
	path = path.split("\\").join("/");

	// Remove leading spaces of the path
	var endIndex = path.length - 1;
	while (endIndex >= 0 && path[endIndex] === ' ') {
		endIndex--;
	}

	return path.substring(0, endIndex + 1);
}

function findItem(name) {
	if (lib.itemExists(name))
		return lib.items[lib.findItemIndex(name)];

	fl.trace("Item not found: " + name);
	return null;
}

function key(normal, optimized) 	{ return optimizeJson ? optimized : normal; }
function jsonVarEnd(name, value)	{ push('"' + name +'":' + value + '\n'); }
function jsonVar(name, value)		{ push('"' + name +'":' + value + ',\n'); }
function jsonStrEnd(name, value)	{ push('"' + name + '":"' + value + '"\n'); }
function jsonStr(name, value)		{ push('"' + name + '":"' + value + '",\n'); }
function jsonArray(name)			{ push('"' + name + '":[\n'); }
function jsonHeader(name)			{ push('"' + name + '":{\n'); }

function measure(func)
{
	var last = Date.now();
	func();
	fl.trace("" + (Date.now() - last) + "ms");
}

function traceFields(value)
{
	for (var field in value)
		fl.trace(field + ": " + value[field]);
}

function isArray(value)
{
	return value.push != undefined;
}

var lastJson = undefined;
var curJson = undefined;

function initJson()
{
	lastJson = curJson;
	curJson = [];
}

function closeJson()
{
	var result = curJson != undefined ? curJson.join("") : "";
	curJson = lastJson;
	return result;
}

function push(data)
{
	curJson.push(data);
}

function removeTrail(trail)
{
	curJson[curJson.length -1] = curJson[curJson.length -1].slice(0, -trail) + "\n";
}

function xmlToObject(__xml)
{
    var rawXML = String(__xml);
    var xmlData = new XML(rawXML);
    return xmlNode(xmlData);
}

function xmlNode(xml)
{
    var obj = {};

	var at = 0;
	while (at < xml.attributes().length())
    {
        var attribute = xml.attributes()[at];
        obj[attribute.name()] = attribute.toString();
        at++;
    }

	var j = 0;
    while (j < xml.children().length())
	{
        var child = xml.children()[j];
        var childName = child.name();
        j++;

		if (obj[childName] == undefined) // Basic value
		{
			obj[childName] = xmlNode(child);
		}
		else if (isArray(obj[childName])) // Repeated value
		{
			obj[childName].push(xmlNode(child));
		}
		else // Start of repeated value
		{
			obj[childName] = [obj[childName], xmlNode(child)];
		}
    }
    
    return obj;
}

