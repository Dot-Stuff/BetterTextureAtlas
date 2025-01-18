﻿var included = {};
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
var BTA_version = "BTA "; // cur bta release version

var _mxi = FLfile.read(fl.configURI + "Commands/BetterTextureAtlas.mxi");

BTA_version += _mxi.split('version="')[2].split('"')[0];

fl.trace(BTA_version);
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
var bakedTweens = false; // TODO
var bakeOneFR = true;
var bakeTexts = false;
/////
var doc = fl.getDocumentDOM();
var lib = doc.library;
var path = "";

var instance = null;
var resScale = 1.0;

if (SaveData.version[0] <= 12)
	alert("Even though it's functional, we still recommend using a newer version, such as Adobe Animate!");

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

	var rawXML = fl.runScript(fl.configURI + "Commands/bta_src/save.scr", "xmlData", [symbols]);

	var xPan = SaveData.openXMLFromString(rawXML);

	if (xPan == null)
	{
		alert("ERROR: Failed loading XML Panel");
		return;
	}
	
	if (xPan.dismiss == "cancel")
	{
		trace("Operation cancelled");
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

	var dataAdd = FLfile.read(fl.configURI + "Commands/bta_src/saveADDBTA.txt").split("\n");
	inlineSym = dataAdd[0] == "true";
	bakeTexts = dataAdd[1] == "true";
	includeSnd = dataAdd[2] == "true";
	bakeOneFR = dataAdd[3] == "true";
	bakedFilters = dataAdd[4] == "true";
	bakedTweens = dataAdd[5] == "true";
	
	var fileuri = xPan.saveBox.split("/").join("\\");
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

	//measure(function() {
	exportAtlas(path, symbols);
	//});

	for (i = 0; i < familySymbol.length; i++)
	{
		doc.getTimeline().currentFrame = frs[i];
		familySymbol[i].selected = true;
		doc.enterEditMode("inPlace");
	}

	doc.getTimeline().currentFrame = curFr;

	if (resizedContain)
		trace("WARNING: some shapes were resized to fit within the 8192 size limit");

	trace("DONE");
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
var bakedDictionary;

var ogSym;
var flversion;

var oneFrameSymbols;

function initVars()
{
	SPRITEMAP_ID = "__BTA_TEMP_SPRITEMAP_";
	TEMP_SPRITEMAP = SPRITEMAP_ID + "0";

	frameQueue = [];
	cachedMatrices = [];
	instanceSizes = [];

	dictionary = [];
	bakedDictionary = [];
	smIndex = 0;

	oneFrameSymbols = {};

	flversion = parseInt(fl.version.split(" ")[1].split(",")[0]);
}

function exportAtlas(exportPath, symbolNames)
{
	initVars();

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

	TEMP_ITEM = initBtaItem(TEMP_SPRITEMAP);

	TEMP_TIMELINE = TEMP_ITEM.timeline;
	TEMP_LAYER = TEMP_TIMELINE.layers[0];
	TEMP_TIMELINE.removeFrames(0,0);

	ogSym = symbol;

	// This is a temp fix for CS6 until i figure out why the file text box is broken
	if (path.indexOf("unknown|") !== -1)
	{
		var defaultOutputFolder = fl.configURI + "Commands/bta_output";
		FLfile.createFolder(defaultOutputFolder);

		exportPath = path = (defaultOutputFolder + "/" + ogSym.name);
		FLfile.createFolder(path);

		trace("ERROR: Invalid output path, export redirected to " + path);
	}

	//measure(function () {

	// Write Animation.json
	FLfile.write(path + "/Animation.json", generateAnimation(symbol));

	// Add items and fix resolutions
	var pos = {x:0, y:0};
	lib.editItem(TEMP_SPRITEMAP);

	var reverseScale = function (element, mat) {
		element.scaleX /= mat.a;
		element.scaleY /= mat.d;
	}

	var i = 0;
	while (i < frameQueue.length)
	{
		var queuedFrame = frameQueue[i].split("_");
		var type = queuedFrame.shift();
		var matrix = cachedMatrices[i];
		var frame = TEMP_LAYER.frames[i];
		
		TEMP_TIMELINE.currentLayer = 0;
		TEMP_TIMELINE.currentFrame = i;

		if (flversion > 12)
			doc.selectNone();

		switch (type)
		{
			case "ITEM":
				var id = queuedFrame.join("");
				lib.addItemToDocument(pos, id);
				
				var item = frame.elements[0];
				reverseScale(item, matrix);
			break;
			case "ELEMENT": // TODO: do some lines to fills crap here for changing resolutions
				var elemIndices = queuedFrame[0].replace("[","").replace("]","").split(",");
				var selection = new Array();

				// Remove frame filters (only from Animate 2020 upwards)
				if (flversion >= 20)
				{
					if (!bakedFilters && TEMP_LAYER.setFiltersAtFrame != undefined)
					{
						TEMP_LAYER.setFiltersAtFrame(i, new Array(0));
					}
				}

				var e = 0;
				var elements = frame.elements;
				while (e < elements.length)
				{
					var element = elements[e];
					var exportElem = elemIndices.indexOf(String(e)) !== -1;

					if (exportElem)
					{
						cleanElement(element);
						reverseScale(element, matrix);

						var filters = element.filters;
						if (filters != undefined && filters.length > 0 && (matrix.a > 1.01 || matrix.d > 1.01))
						{
							doc.selectNone();
							doc.selection = [element];

							forEachFilter(filters, function (filter) {
								switch (filter.name)
								{
									case "glowFilter":
									case "blurFilter":
										filter.blurX /= matrix.a;
										filter.blurY /= matrix.d;
									break;
								}
							});

							doc.setFilters(filters);
						}
					}
					else if (flversion > 12 || element.elementType != "shape") // Half-assed fix for broken shape cleanup on CS6, give it a look later
					{
						selection[selection.length] = element;
					}

					e++;
				}

				if (selection.length > 0)
				{
					TEMP_TIMELINE.currentFrame = i;
					
					if (flversion > 12)
						doc.selectNone();
					
					doc.selection = selection;
					doc.deleteSelection();
				}

			break;
		}

		i++;
	}
	
	if (flversion < 12) // Super primitive spritemap export for versions below CS6
	{
		var shapeLength = TEMP_TIMELINE.frameCount;
		var SPRITESHEET_ID = "__BTA_TEMP_SPRITESHEET_";

		var sheetItem = initBtaItem(SPRITESHEET_ID);
		var sheetFrame = sheetItem.timeline.layers[0].frames[0];
		lib.editItem(sheetItem.name);

		var ogWidth = doc.width;
		var ogHeight = doc.height;

		var sheet = cs4Spritesheet(shapeLength, sheetFrame);
		doc.width = Math.floor(sheet.width);
		doc.height = Math.floor(sheet.height);

		var smPath = path + "/spritemap1";
		writeFile(smPath + ".json", sheet.json);

		if (FLfile.exists(smPath + ".png"))
			FLfile.remove(smPath + ".png");
		
		doc.exportPNG(smPath, true, true);
		renameFile(smPath + "img.png", smPath + ".png");

		doc.width = ogWidth;
		doc.height = ogHeight;

		doc.selectNone();
		doc.exitEditMode();

		lib.deleteItem(SPRITESHEET_ID);
		lib.deleteItem(TEMP_SPRITEMAP);
	}
	else // Use the actual spritesheet exporter on CS6 and above
	{
		doc.selectNone();
		doc.exitEditMode();

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
	}

	if (tmpSymbol)
		lib.deleteItem(symbol.name);

	trace("Exported to folder: " + exportPath);
}

function cleanElement(elem)
{
	elem.scaleX = elem.scaleY = 1;
	elem.rotation = 0;

	if (!flattenSkewing)
		elem.skewX = elem.skewY = 0;

	if (elem.blendMode != null)
		elem.blendMode = "normal";

	if (elem.colorMode != null)
		elem.colorMode = "none";
}

function initBtaItem(ID)
{
	if (lib.itemExists(ID))
	{
		trace("WARNING: removing " + ID + " item");
		lib.deleteItem(ID);
	}

	lib.addNewItem("graphic", ID);
	return findItem(ID);
}

var spritemaps;

function divideSpritemap(smData, symbol)
{
	var parent = smData.sm;
	var framesLength = symbol.timeline.layers[0].frames.length;
	var cutFrames = Math.floor(framesLength * 0.5);

	if (framesLength === 1)
	{
		alert("ERROR: a shape couldnt fit inside the spritemap");
		return;
	}

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

	// TODO: this is causing issues for CS6, revise later
	if (optimizeDimensions && flversion > 12) for (__ = 0; __ < 2; __++) // TODO: figure out a better way to double-check trimmed resolutions
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

		// expand the frame a pixel because animate makes em too small for some reason
		var frameValues = frame.split(",");
		frameValues[0] = '"x":' + (parseInt(frameValues[0].substring(4, frameValues[0].length)) - 1);
		frameValues[1] = '"y":' + (parseInt(frameValues[1].substring(4, frameValues[1].length)) - 1);
		frameValues[2] = '"w":' + (parseInt(frameValues[2].substring(4, frameValues[2].length)) + 1);
		frameValues[3] = '"h":' + (parseInt(frameValues[3].substring(4, frameValues[3].length)) + 1);

		smJson.push('{"SPRITE":{"name":"' +  name + '",' + frameValues.join(",") + ',' + rotated + '}}');
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
	sm.borderPadding = max(BrdPad, 1);
	sm.shapePadding = max(ShpPad, 1);
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
	push('}');

	var animJson;

	// Add Symbol Dictionary
	if (dictionary.length > 0 || bakedDictionary.length > 0)
	{
		if (inlineSym)
		{
			push(',\n');
			jsonHeader(key("SYMBOL_DICTIONARY", "SD"));
			jsonArray(key ("Symbols", "S"));

			var dictIndex = 0;
			while (dictIndex < dictionary.length)
			{
				var symbol = findItem(dictionary[dictIndex++]);
				curSymbol = symbol.name;
				if (curSymbol == ogSym.name)
					continue;
				
				push('{\n');
				jsonStr(key("SYMBOL_name", "SN"), curSymbol);
				jsonHeader(key("TIMELINE", "TL"));
				parseSymbol(symbol);
				push('},');
			}
			
			dictIndex = 0;
			while (dictIndex < bakedDictionary.length)
			{
				push(bakedDictionary[dictIndex]);
				dictIndex += 2;
				push(',');
			}

			removeTrail(1);
			push(']}');
		}
		else
		{
			push("}");
			animJson = closeJson();

			FLfile.createFolder(path + "/LIBRARY");

			var pushSymbolLibrary = function (symbolName, jsonContent)
			{
				var pathDict = symbolName.split("/");
				var folderStuff = "";
				var foldI = 0;
				
				while (foldI < pathDict.length - 1)
				{
					if (folderStuff != "") folderStuff += "/";
					folderStuff += pathDict[foldI];
					FLfile.createFolder(path + "/LIBRARY/" + folderStuff);
					foldI++;
				}
	
				FLfile.write(path + "/LIBRARY/" + symbolName + ".json", jsonContent);
			}

			var dictIndex = 0;
			while (dictIndex < dictionary.length)
			{
				var symbol = findItem(dictionary[dictIndex++]);
				curSymbol = symbol.name;
				if (curSymbol == ogSym.name)
					continue;
				
				initJson();
				push("{");
				push(parseSymbol(symbol));
				pushSymbolLibrary(curSymbol, closeJson());
			}

			dictIndex = 0;
			while (dictIndex < bakedDictionary.length)
			{
				pushSymbolLibrary(bakedDictionary[dictIndex + 1], bakedDictionary[dictIndex]);
				dictIndex += 2;
			}
		}
	}

	// Add Metadata
	if (inlineSym)
	{
		push(",\n");
		jsonHeader(key("metadata", "MD"));
		metadata();
		push('}}');
		animJson = closeJson();
	}
	else
	{		
		initJson();
		push("{\n");
		metadata();
		push("}\n");

		FLfile.write(path + "/metadata.json", closeJson());
	}

	return animJson;
}

function metadata()
{
	jsonStr(key("version", "V"), BTA_version);
	jsonVarEnd(key("framerate", "FRT"), doc.frameRate);
}

function pushOneFrameSymbol(symbolInstance, timeline, layerIndex, frameIndex, elemIndex)
{
	var item = symbolInstance.libraryItem;
	var name = item.name;

	if (oneFrameSymbols[name] != null)
		return;

	oneFrameSymbols[name] = smIndex;
	pushElementsFromFrame(timeline, layerIndex, frameIndex, [elemIndex]);
	smIndex++;
}

function isOneFrame(itemTimeline) {
	return bakeOneFR && (itemTimeline.frameCount == 1) && (itemTimeline.layers.length > 1);
}

function parseSymbol(symbol)
{
	var timeline = symbol.timeline;
	var layers = timeline.layers;

	jsonArray(key("LAYERS", "L"));

	if (isOneFrame(timeline))
	{
		makeBasicLayer(function () {
			var index = oneFrameSymbols[symbol.name];
			var symbolElem = TEMP_LAYER.frames[index].elements[0];
			cleanElement(symbolElem)

			var bounds = getFrameBounds(timeline, 0);
			var scale = getMatrixScale(bounds.right - bounds.left, bounds.bottom - bounds.top);
			var matrix = makeMatrix(scale, 0, 0, scale, bounds.left, bounds.top);

			resizeInstanceMatrix(curSymbol, matrix);
			parseAtlasInstance(matrix, index);
		});
		return;
	}

	var l = 0;
	while (l < layers.length)
	{
		var layer = layers[l];
		var layerType = layer.layerType;

		if ((layer.visible || !onlyVisibleLayers) && layer.frameCount > 0 && layerType != "guide" && layerType != "guided")
		{
			var lockedLayer = layer.locked;
			layer.locked = false;

			push('{\n');
			jsonStr(key("Layer_name", "LN"), layer.name);

			switch (layerType)
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

			if (layerType != "folder") {
				parseFrames(layer.frames, l, timeline);
				curFrameMatrix = null;
			}

			push('},');

			layer.locked = lockedLayer;
		}
		l++;
	}

	removeTrail(1);
	push(']}');
}

function makeBasicLayer(elementCallback) {
	push('{');
	jsonStr(key("Layer_name", "LN"), "Layer 1");
	jsonArray(key("Frames", "FR"));
	push('{');
	jsonVar(key("index", "I"), 0);
	jsonVar(key("duration", "DU"), 1);
	jsonArray(key("elements", "E"));
	push('{');
	if (elementCallback != null)
		elementCallback();
	push('}]}]}]}');
}

function parseFrames(frames, layerIndex, timeline)
{
	jsonArray(key("Frames", "FR"));

	var layer = timeline.layers[layerIndex];
	var hasRig = (flversion >= 20) && (layer.getRigParentAtFrame(0) != undefined);

	var f = 0;
	while (f < frames.length)
	{
		var frame = frames[f];
		var pushFrame = (f === frame.startFrame);

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
					jsonArray(key("curve", "CV"));
					var e = 0;
					var eases = frame.getCustomEase();
					while (e < eases.length)
					{
						var field = eases[e++];
						push("{");
						jsonVar("x", field.x);
						jsonVarEnd("y", field.y);
						push("},\n");
					}

					if (eases.length > 0)
						removeTrail(2);
					
					push("],\n");
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
					jsonStrEnd(key("type", "T"), key("shape", "SHP"));
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
				
				var fileName = frame.soundLibraryItem.name;
				if (fileName.indexOf(ext) === -1)
					fileName += ext;
				
				frame.soundLibraryItem.exportToFile(path + "/LIBRARY/" + fileName);
				jsonHeader(key("Sound", "SND"));

				jsonStr(key("name", "N"), fileName);
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
			
			if (!bakedFilters)
			{
				var frameFilters = getFrameFilters(timeline.layers[layerIndex], f);
				if (frameFilters.length > 0)
				{
					parseFilters(frameFilters);
					removeTrail(1);
					push(",");
				}
			}

			curFrameMatrix = (hasRig) ? layer.getRigMatrixAtFrame(f) : null;
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
				jsonNumEnd(key("index", "I"), keyframe.timevalue * 0.001);
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

var curFrameMatrix;

function parseElements(elements, frameIndex, layerIndex, timeline)
{
	jsonArray(key("elements", "E"));

	var e = 0;
	var shapeQueue = [];

	var frameFilters = getFrameFilters(timeline.layers[layerIndex], frameIndex);
	var hasFrameFilters = (bakedFilters && frameFilters.length > 0);

	while (e < elements.length)
	{
		var element = elements[e];
		var elementType = element.elementType;
		var isShape = (elementType == "shape");
		
		if (isShape) // Adobe sometimes forgets how their own software works
		{
			shapeQueue.push(e);
		}
		else
		{
			if (shapeQueue.length > 0)
			{
				push("{");
				parseShape(timeline, layerIndex, frameIndex, shapeQueue)
				push("},\n");
				shapeQueue = [];
			}

			push("{");
		}

		switch (element.elementType)
		{
			case "instance":
				switch (element.instanceType) {
					case "symbol":

					var hasFilters = element.filters != undefined && element.filters.length > 0;
					var bakeInstanceFilters = (bakedFilters && (hasFilters || hasFrameFilters));
					//var bakeInstanceSkew = (flattenSkewing && (element.skewX != 0 || element.skewY != 0));
					var bakeInstance = (bakeInstanceFilters);// || bakeInstanceSkew);
					
					if (bakeInstance)
					{
						pushElementSpritemap(timeline, layerIndex, frameIndex, [e], frameFilters);
					}
					else
					{
						if (isOneFrame(element.libraryItem.timeline))
						{
							pushOneFrameSymbol(element, timeline, layerIndex, frameIndex, e);
						}

						parseSymbolInstance(element);
					}

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
						if (!element.useDeviceFonts || bakeTexts)
						{
							pushElementSpritemap(timeline, layerIndex, frameIndex, [e], frameFilters);
						}
						else
						{
							parseTextInstance(element);
						}
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
		if (hasFrameFilters && bakedFilters)
		{
			pushElementSpritemap(timeline, layerIndex, frameIndex, shapeQueue, frameFilters);
		}
		else
		{
			parseShape(timeline, layerIndex, frameIndex, shapeQueue);
		}
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

	var orientation = null;
	switch (text.orientation)
	{
		case "horizontal":				orientation = key("horizontal", "HR");					break;
		case "vertical left to right":	orientation = key("vertical right to left", "VLTR");	break;
		case "vertical right to left":	orientation = key("vertical right to left", "VRTL");	break;
	}

	if (orientation != null)
		jsonStr(key("orientation", "ORT"), orientation);

	var linetype = null;
	if (text.textType != "static")
	{
		switch (text.lineType)
		{
			case "single line": 		linetype = key("single line", "SL"); 				break;
			case "multiline": 			linetype = key("multiline", "ML");			 		break;
			case "multiline no wrap": 	linetype = key("multiline no wrap", "MLN"); 		break;
			case "password": 			linetype = key("password", "PSW"); 					break;
		}
	}

	if (lineType != null)
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

var cachedMatrices;

function parseBitmapInstance(bitmap)
{
	var item = bitmap.libraryItem;
	var matrix = cloneMatrix(bitmap.matrix);
	var scale = getMatrixScale(item.hPixels, item.vPixels);

	if (scale > 1)
	{
		matrix.a *= scale;
		matrix.d *= scale;
	}

	var itemIndex = pushItemSpritemap(item);
	parseAtlasInstance(matrix, itemIndex);
}

function getShapeBounds(shape)
{
	var vertexBounds = getVerticesBounds(shape.vertices);
	return {
		left: shape.x + (vertexBounds.left * 0.5),
		top: shape.y + (vertexBounds.top * 0.5),
		right: vertexBounds.right,
		bottom: vertexBounds.bottom
	}
}

function parseShape(timeline, layerIndex, frameIndex, elementIndices)
{
	var shapes = pushShapeSpritemap(timeline, layerIndex, frameIndex, elementIndices);
	var atlasIndex = (smIndex - 1);
	var mtx = undefined;
	
	var shapeX = Number.POSITIVE_INFINITY;
	var shapeY = Number.POSITIVE_INFINITY;
	var shapeWidth = Number.NEGATIVE_INFINITY;
	var shapeHeight = Number.NEGATIVE_INFINITY;

	var s = 0;
	while (s < shapes.length)
	{
		var bounds = getShapeBounds(shapes[s++]);
		shapeX = min(shapeX, bounds.left);
		shapeY = min(shapeY, bounds.top);
		shapeWidth = max(shapeWidth, bounds.right);
		shapeHeight = max(shapeHeight, bounds.bottom);

		// isRectangle = (shape.isRectangleObject || shape.vertices.length === 4)
	}

	var transformingX = (shapeX - (shapeWidth * 0.5));
	var transformingY = (shapeY - (shapeHeight * 0.5));

	var scale = getMatrixScale(shapeWidth, shapeHeight);		
	var mtx = makeMatrix(scale, 0, 0, scale, transformingX, transformingY);

	resizeInstanceMatrix(curSymbol, mtx);
	parseAtlasInstance(mtx, atlasIndex);
}

function getElementRect(instance, frameFilters)
{
	var minX; var minY; var maxX; var maxY;

	switch (instance.elementType)
	{
		case "shape":
			var bounds = getShapeBounds(instance);
			minX = bounds.left;
			minY = bounds.top;
			maxX = bounds.right;
			maxY = bounds.bottom;
		break;
		case "instance":
			var timeline = instance.libraryItem.timeline;
			var frameIndex = (instance.firstFrame != undefined) ? instance.firstFrame : 0;

			minX = minY = Number.POSITIVE_INFINITY;
			maxX = maxY = Number.NEGATIVE_INFINITY;
		
			var l = 0;
			while (l < timeline.layers.length)
			{
				var frameElements = timeline.layers[l++].frames[frameIndex].elements;
				var e = 0;
				while (e < frameElements.length)
				{
					var elem = getElementRect(frameElements[e++]);
					minX = min(minX, elem.x);
					minY = min(minY, elem.y);
					maxX = max(maxX, elem.width);
					maxY = max(maxY, elem.height);
				}
			}
		break;
		case "text":
			minX = minY = maxX = maxY = 0;
		break;
	}

	var instanceFilters = new Array();

	if (frameFilters != null && frameFilters.length > 0)
		instanceFilters = instanceFilters.concat(frameFilters);

	if (instance.filters != null && instance.filters.length > 0)
		instanceFilters = instanceFilters.concat(instance.filters);
	
	forEachFilter(instanceFilters, function (filter) {
		switch (filter.name)
		{
			case "glowFilter":
				if (filter.inner)
					break;
			case "blurFilter":
				var blurMult = getQualityScale(filter.quality);
				minX -= filter.blurX * blurMult;
				minY -= filter.blurY * blurMult;
				maxX += filter.blurX * blurMult;
				maxY += filter.blurY * blurMult;
			break;
		}
	});

	return {
		x: minX,
		y: minY,
		width: maxX,
		height: maxY
	}
}

// TODO: make this check for invalid / corrupted contours
// some shapes keep giving incorrect values, seamingly randomly
// i hate this
function getVerticesBounds(vertices)
{
	var minVertX = Number.POSITIVE_INFINITY;
	var minVertY = Number.POSITIVE_INFINITY;
	var maxVertX = Number.NEGATIVE_INFINITY;
	var maxVertY = Number.NEGATIVE_INFINITY;

	var v = 0;
	while (v < vertices.length)
	{
		var vert = vertices[v++];				
		minVertX = min(minVertX, vert.x);
		minVertY = min(minVertY, vert.y);
		maxVertX = max(maxVertX, vert.x);
		maxVertY = max(maxVertY, vert.y);
	}

	return {
		left: minVertX,
		top: minVertY,
		right: maxVertX,
		bottom: maxVertY
	}
}

var resizedContain = false;

function getMatrixScale(width, height)
{
	var maxSize = max(width * resolution, height * resolution);
	var mxScale = resScale;
	
	if (maxSize > 8192)
	{
		resizedContain = true;
		mxScale = 1.0 / (((8192 / maxSize) / 1.01) * resolution); // pixel rounding crap
	}
	
	return mxScale;
}

function parseAtlasInstance(matrix, index)
{
	cachedMatrices[index] = matrix;
	jsonHeader(key("ATLAS_SPRITE_instance", "ASI"));
	jsonVar(key("Matrix", "MX"), parseMatrix(matrix));
	jsonStrEnd(key("name", "N"), index);
	push('}');
}

function pushElementsFromFrame(timeline, layerIndex, frameIndex, elementIndices)
{
	timeline.setSelectedLayers(layerIndex, true);
	timeline.copyFrames(frameIndex);
	TEMP_TIMELINE.pasteFrames(smIndex);
	pushElement(elementIndices);
}

function pushElementSpritemap(timeline, layerIndex, frameIndex, elementIndices, frameFilters)
{
	pushElementsFromFrame(timeline, layerIndex, frameIndex, elementIndices);

	initJson();
	push('{\n');
	
	var itemName = "_bta_asi_" + smIndex;
	jsonStr(key("SYMBOL_name", "SN"), itemName);
	jsonHeader(key("TIMELINE", "TL"));
	jsonArray(key("LAYERS", "L"));

	var elem = TEMP_LAYER.frames[smIndex].elements[elementIndices[0]];
	var rect = getElementRect(elem, frameFilters);

	var matScale = getMatrixScale(rect.width, rect.height);
	var matScaleX = (elem.scaleX < 1) ? (1 / elem.scaleX) * matScale : matScale;
	var matScaleY = (elem.scaleY < 1) ? (1 / elem.scaleY) * matScale : matScale;

	if (bakedFilters)
	{
		var scaleXMult = 1;
		var scaleYMult = 1;
	
		// Scaling down blurry symbols so antialiasing can do the dirty work later
		forEachFilter(elem.filters, function (filter) {
			switch (filter.name) {
				case "blurFilter":
					var qualityScale = 0.5;
					if (filter.quality == "medium") qualityScale = 0.75;
					if (filter.quality == "low") 	qualityScale = 1;
					scaleXMult *= (filter.blurX / (16 * qualityScale));
					scaleYMult *= (filter.blurY / (16 * qualityScale));
				break;
			}
		});
	
		matScaleX *= max(scaleXMult, 1);
		matScaleY *= max(scaleYMult, 1);
	}

	var atlasMatrix = makeMatrix(matScaleX, 0, 0, matScaleY,
		rect.x - (rect.width * 0.5),
		rect.y - (rect.height * 0.5)
	);

	makeBasicLayer(function () {
		parseAtlasInstance(atlasMatrix, smIndex);
		smIndex++;
	});

	push('}');

	bakedDictionary.push(closeJson());
	bakedDictionary.push(itemName);
	parseSymbolInstance(elem, itemName);
}

function forEachFilter(filters, callback)
{
	if (filters == undefined || filters.length <= 0)
		return;

	var f = 0;
	while (f < filters.length) {
		callback(filters[f++]);
	}
}

function getFrameBounds(timeline, frameIndex)
{
	// For versions where its allowed, timeline.getBounds is generally faster than our own function
	// TODO: may have to change in the future due to filter bounds tho
	if (flversion >= 15)
	{
		return timeline.getBounds(frameIndex + 1);
	}

	var minX = Number.POSITIVE_INFINITY;
	var minY = Number.POSITIVE_INFINITY;
	var maxX = Number.NEGATIVE_INFINITY;
	var maxY = Number.NEGATIVE_INFINITY;

	var l = 0;
	while (l < timeline.layerCount)
	{
		var layer = timeline.layers[l++];	
		if (frameIndex > layer.frameCount - 1)
			continue;

		var e = 0;
		var elems = layer.frames[frameIndex].elements;
		
		while (e < elems.length)
		{
			var elem = elems[e++];

			switch (elem.elementType)
			{
				case "shape":
					var rect = getVerticesBounds(elem.vertices);
					minX = min(minX, rect.left);
					minY = min(minY, rect.top);
					maxX = max(maxX, rect.right);
					maxY = max(maxY, rect.bottom);
				break;
				default:
					var rect = getElementRect(elem);
					minX = min(minX, rect.x);
					minY = min(minY, rect.y);
					maxX = max(maxX, rect.x + rect.width);
					maxY = max(maxY, rect.y + rect.height);
				break;
			}
		}
	}

	return {
		left: minX,
		top: minY,
		right: maxX,
		bottom: maxY
	}
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

function pushShapeSpritemap(timeline, layerIndex, frameIndex, elementIndices)
{
	pushElementsFromFrame(timeline, layerIndex, frameIndex, elementIndices);

	var frameElements = TEMP_LAYER.frames[smIndex].elements;
	var shapes = [];

	var e = 0;
	var ei = 0;
	var lastWidth = Number.NEGATIVE_INFINITY;
	var lastHeight = Number.NEGATIVE_INFINITY;

	while (e < frameElements.length)
	{
		var frameElement = frameElements[e];

		if (elementIndices[ei] == e) // Add the actual parts of the array
		{
			ei++;
			
			var elemWidth = Math.round(frameElement.width);
			var elemHeight = Math.round(frameElement.height);
			
			// Checking because its both the same shape instance but also not?? Really weird shit
			if (elemWidth != lastWidth && elemHeight != lastHeight)
			{
				// Gotta do this because jsfl scripts cant keep track well of instances data and will randomly corrupt values
				shapes.push({
					x: frameElement.x,
					y: frameElement.y,
					vertices: frameElement.vertices
				});

				lastWidth = elemWidth;
				lastHeight = elemHeight;
			}
		}

		e++;
	}

	smIndex++;
	return shapes;
}

function pushElement(elemIndices)
{
	frameQueue.push("ELEMENT_" + String(elemIndices));
}

var instanceSizes;
var curSymbol;

function resizeInstanceMatrix(name, matrix)
{
	var maxScale = instanceSizes[name];
	if (maxScale == null)
		return;
	
	matrix.a /= maxScale[0];	
	matrix.d /= maxScale[1];
}

// TODO: make this inheritance based so its a full calculation of all the max sizes of the instance
function pushInstanceSize(name, scaleX, scaleY)
{
	if (instanceSizes[name] == null)
	{
		var list = [scaleX, scaleY];
		instanceSizes[name] = list;
		return;
	}

	var list = instanceSizes[name];
	list[0] = max(list[0], scaleX);
	list[1] = max(list[1], scaleY);
}

function getFrameFilters(layer, frameIndex)
{
	if (flversion >= 20 && layer.getFiltersAtFrame != null)
	{
		var filters = layer.getFiltersAtFrame(frameIndex);
		if (filters != null)
			return filters;
	}

	return new Array(0);
}

function parseSymbolInstance(instance, itemName)
{
	var bakedInstance = (itemName != undefined);
	jsonHeader(key("SYMBOL_Instance", "SI"));

	if (itemName == undefined)
	{
		item = instance.libraryItem;
		if (item != undefined) {
			itemName = item.name;
			if (dictionary.indexOf(itemName) == -1)
				dictionary.push(itemName);
		}
	}

	if (itemName != undefined) {
		jsonStr(key("SYMBOL_name", "SN"), itemName);

		if (!bakedInstance)
		{
			var scaleX = instance.scaleX;
			var scaleY = instance.scaleY;

			if (curFrameMatrix != null)
			{
				scaleX *= curFrameMatrix.a;
				scaleY *= curFrameMatrix.d;
			}

			pushInstanceSize(itemName, scaleX, scaleY);
		}
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

	if (instance.colorMode != "none")// && !(bakedInstance && bakedFilters))
	{
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
				jsonNumEnd(key("tintMultiplier", "TM"), instance.tintPercent * 0.01);
			break;
			case "alpha":
				jsonStr(modeKey, key("Alpha", "CA"));
				jsonNumEnd(key("alphaMultiplier", "AM"), instance.colorAlphaPercent * 0.01);
			break;
			case "advanced":
				jsonStr(modeKey, key("Advanced", "AD"));
				jsonNum(key("RedMultiplier", "RM"), instance.colorRedPercent * 0.01);
				jsonNum(key("greenMultiplier", "GM"), instance.colorGreenPercent * 0.01);
				jsonNum(key("blueMultiplier", "BM"), instance.colorBluePercent * 0.01);
				jsonNum(key("alphaMultiplier", "AM"), instance.colorAlphaPercent * 0.01);
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
		if (instance.blendMode != null && instance.blendMode != "normal")
			jsonVar(key("blend", "B"), parseBlendMode(instance.blendMode));

		var filters = instance.filters;
		var hasFilters = (filters != null && filters.length > 0)

		// Add Filters
		if (hasFilters && !bakedFilters)
		{
			parseFilters(filters)
		}
		else
		{
			removeTrail(2);
		}
	}
	else removeTrail(2);

	push('}');
}

function parseBlendMode(blend)
{
	switch (blend)
	{
		case "add": return 0;
		case "alpha": return 1;
		case "darken": return 2;
		case "difference": return 3;
		case "erase": return 4;
		case "hardlight": return 5;
		case "invert": return 6;
		case "layer": return 7;
		case "lighten": return 8;
		case "multiply": return 9;
		case "overlay": return 11;
		case "screen": return 12;
		case "subtract": return 14;
	}

	return 10; // normal
}

function parseFilters(filters)
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

function makeMatrix(a, b, c, d, tx, ty) { return {a: a, b: b, c: c, d: d, tx: tx, ty: ty} }
function cloneMatrix(mat) { return makeMatrix(mat.a, mat.b, mat.c, mat.d, mat.tx, mat.ty); }

function parseMatrix(m)
{
	// Concat the current frame matrix
	if (curFrameMatrix != null)
	{
		m = fl.Math.concatMatrix(m, curFrameMatrix);
	}
	
	return "[" +
	rValue(m.a) + "," + rValue(m.b) + "," + rValue(m.c) + "," +
	rValue(m.d) + "," + rValue(m.tx) + "," + rValue(m.ty) +
	"]";
}

function parseMatrix3D(m) {
	return "[" +
	m.m00 + "," + m.m01 + "," + m.m02 + "," + m.m03 + "," +
	m.m10 + "," + m.m11 + "," + m.m12 + "," + m.m13 + "," +
	m.m20 + "," + m.m21 + "," + m.m22 + "," + m.m23 + "," +
	m.m30 + "," + m.m31 + "," + m.m32 + "," + m.m33 +
	"]";
}

function parseArray(array) {
	return '["' + array.join('","') +'"]';
}

function getQualityScale(quality)
{
	if (quality == "low") return 0.333;
	if (quality == "medium") return 0.75;
	return 1;
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

	trace("Item not found: " + name);
	return null;
}

function key(normal, optimized) 	{ return optimizeJson ? optimized : normal; }
function jsonVarEnd(name, value)	{ push('"' + name + '":' + value + '\n'); }
function jsonVar(name, value)		{ push('"' + name + '":' + value + ',\n'); }
function jsonStrEnd(name, value)	{ push('"' + name + '":"' + value + '"\n'); }
function jsonStr(name, value)		{ push('"' + name + '":"' + value + '",\n'); }
function jsonArray(name)			{ push('"' + name + '":[\n'); }
function jsonHeader(name)			{ push('"' + name + '":{\n'); }

function jsonNumEnd(name, value) { jsonVarEnd(name, rValue(value)); }
function jsonNum(name, value) { jsonVar(name, rValue(value)); }
function rValue(value) { return parseFloat(value.toFixed(3)); }

function measure(func)
{
	var last = Date.now();
	func();
	trace("" + (Date.now() - last) + "ms");
}

function traceArray(array)
{
	trace(array.join(", "));
}

function traceFields(value)
{
	var traceCrap = "";
	for (var field in value)
		traceCrap += field + ": " + value[field] + ", ";
	trace(traceCrap);
}

function trace(msg) {
	fl.trace(String(msg));
}

function isArray(value)
{
	return value.push != undefined;
}

// I have no idea why jsfl corrupts Math.min and Math.max, sooooo yeah
function min(a, b) {
	return (a < b) ? a : b;
}

function max(a, b) {
	return (a > b) ? a : b;
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
    var xmlData = new XML(String(__xml));
    return xmlNode(xmlData);
}

function xmlNode(xml)
{
    var obj = {};

	var at = 0;
	var attributes = xml.attributes();
	while (at < atrib.length())
    {
        var attribute = attributes[at++];
        obj[attribute.name()] = attribute.toString();
    }

	var j = 0;
	var children = xml.children();
    while (j < children.length())
	{
        var child = children[j++];
        var childName = child.name();

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

function writeFile(path, content)
{
	if (FLfile.exists(path))
		FLfile.remove(path);

	FLfile.write(path, content);
}

function renameFile(path, newPath)
{
	FLfile.copy(path, newPath);
	FLfile.remove(path);
}

function cs4Spritesheet(shapeLength, sheetFrame)
{
    var curX = BrdPad;
    var curY = BrdPad;
    var sheetWidth = 0;
    var maxHeight = 0;
    var maxSheetWidth = 0;
    var maxSheetHeight = 0;
    var packedRectangles = [];

	var elem;
	var rect;

	var moveElement = function (x, y) {
		elem.x = x - (rect.x - (rect.width * 0.5)) * elem.scaleX;
		elem.y = y - (rect.y - (rect.height * 0.5)) * elem.scaleY;
	}

	lib.addItemToDocument({x: 0, y: 0}, TEMP_SPRITEMAP);

    while (sheetFrame.elements.length < shapeLength)
	{
		doc.selectNone();
		doc.selection = sheetFrame.elements;
		doc.clipCopy();
		doc.clipPaste();
	}
    
    i = 0;
    while (i < shapeLength)
	{   
		var ogElem = TEMP_LAYER.frames[i].elements[0];
		elem = sheetFrame.elements[i];
		elem.firstFrame = i;
		i++;

		rect = getElementRect(ogElem);
		var rectWidth = rect.width;
		var rectHeight = rect.height;

		moveElement(curX, curY);

		var packedRect = {
            x: Math.floor(curX),
            y: Math.floor(curY),
            width: Math.floor(rectWidth),
            height: Math.floor(rectHeight)
        }

		packedRectangles.push(packedRect);
        
        if (curX + rectWidth + ShpPad > 2880)
		{
            curX = BrdPad;
            curY += maxHeight + ShpPad;
            maxHeight = 0;

			packedRect.x = Math.floor(curX);
			packedRect.y = Math.floor(curY);

			moveElement(curX, curY);
			curX += rectWidth + ShpPad;
        }
		else {
            curX += rectWidth + ShpPad;
            maxHeight = Math.max(maxHeight, rectHeight);
            sheetWidth = Math.max(sheetWidth, curX);
        }

        maxSheetWidth = Math.max(maxSheetWidth, sheetWidth);
        maxSheetHeight = Math.max(maxSheetHeight, curY + maxHeight);
    }

	var extraShapes = sheetFrame.elements.length - shapeLength;
	if (extraShapes > 0)
	{
		i = shapeLength;
		doc.selectNone();
		
		while (i < sheetFrame.elements.length)
		{
			sheetFrame.elements[i++].selected = true;
		}

		doc.deleteSelection();
	}

	initJson();
	push('{"ATLAS":{"SPRITES":[\n');

	var i = 0;
	while (i < packedRectangles.length)
	{	
		var rect = packedRectangles[i];
		push('{"SPRITE":{"name":"' + i +
			'","x":' + rect.x + ',"y":' + rect.y + ',"w":' + rect.width + ',"h":' + rect.height +
			',"rotated":' + false +
		'}},\n');
		i++;
	}

	removeTrail(2);
	push("]}}\n");

    return {
        width: maxSheetWidth,
        height: maxSheetHeight,
        rectangles: packedRectangles,
		json: closeJson()
    };
}