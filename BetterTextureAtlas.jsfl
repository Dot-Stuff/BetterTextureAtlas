fl.outputPanel.clear(); // debug purposes
fl.showIdleMessage(false);

var scriptFolder = findScriptURI();

var included = {};
fl.include = function(file) {
	if (included[file]) { return; }
		included[file] = true;
	eval(FLfile.read(scriptFolder+"/bta_src/"+file+".js"));
}

fl.include("SaveData");

///// CONFIGURATION

var symbols = [];
var meshExport = false; // If to use a spritemap or mesh vertex data

// cur bta release version
var _mxiPath = scriptFolder+"/BetterTextureAtlas.mxi";
var BTA_version = "BTA ??? (Missing MXI)";
if (FLfile.exists(_mxiPath))
	BTA_version = "BTA " + FLfile.read(_mxiPath).split('version="')[2].split('"')[0];

trace(BTA_version);
var algorithm = "maxRects";
var onlyVisibleLayers = true;
var optimizeDimensions = true;
var optimizeJson = true;
//var flattenSkewing = false;
var allowRotation = true;
var resolution = 1.0;
var version = SaveData.prototype.version;
var ShpPad = 0;
var BrdPad = 0;
var bitDepth = 32;
///// ADDITIONAL BIZZ
var inlineSym = false;
var includeSnd = true;
var includeAs = false;

var bakedFilters = false;
var bakedTweens = false;
var bakeOneFR = true;
var bakeTexts = false;
/////
var doc = fl.getDocumentDOM();
var lib = doc.library;
var path = "";

var instance = null;
var resScale = 1.0;

function findScriptURI()
{
	var err = new Error();
	var stack = err.stack;

	var scriptPath = stack.split("\n").join("").split("Error()@:0findScriptURI()@").join("");
	scriptPath = scriptPath.split("@")[0];

	var pathSplit = scriptPath.split(":");
	pathSplit.pop();
	scriptPath = pathSplit.join(":");

	scriptPath = FLfile.platformPathToURI(scriptPath);
	
	if (FLfile.exists(scriptPath)) {
		pathSplit = scriptPath.split("/");
		pathSplit.pop();
		return pathSplit.join("/");
	}
	
	return fl.configURI + 'Commands';
}

function _main()
{
	if (doc == null)
	{
		alert("You need to be in an document in order to export the atlas");
		return;
	}

	var profileXML = fl.getDocumentDOM().exportPublishProfileString(); 
	onlyVisibleLayers = profileXML.split("<InvisibleLayer>")[1].charAt(0) == "0";

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

	if (flversion <= 12)
	{
		alert("WARNING: Even though it's functional, we still recommend using a newer version, such as Adobe Animate!");
	}

	var res = 1.0;
	var optDimens = "true";
	var optAn = "true";
	//var flatten = "false";
	var allRot = "true";
	
	//var rawXML = fl.runScript(scriptFolder+"/bta_src/save.js", "xmlData", symbols.join("_bta_"), scriptFolder);

	SaveData.setupSaves(scriptFolder);
	var rawXML = SaveData.xmlData(symbols.join("_bta_"), scriptFolder);
	var xPan = SaveData.openXMLFromString(rawXML, scriptFolder);

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

	var curTl = doc.getTimeline();
	var curFr = curTl.currentFrame;
	var tlIndex = doc.currentTimeline;
	var curZoom = doc.zoomFactor;

	ShpPad = parseInt(xPan.ShpPad);
	BrdPad = parseInt(xPan.BrdPad);
	res = xPan.ResSld;
	optDimens = xPan.OptDimens;
	optAn = xPan.OptAn;
	//flatten = xPan.FlatSke;
	allRot = xPan.Rotate;

	bitDepth = (xPan.imgFormat == "PNG 8 bits") ? 8 : 32;
	algorithm = (xPan.algorithm == "Basic") ? "basic" : "maxRects";

	var dataAdd = FLfile.read(scriptFolder+"/bta_src/saveADDBTA.txt").split("\n");
	inlineSym = dataAdd[0] == "true";
	bakeTexts = dataAdd[1] == "true";
	includeSnd = dataAdd[2] == "true";
	bakeOneFR = dataAdd[3] == "true";
	bakedFilters = dataAdd[4] == "true";
	bakedTweens = dataAdd[5] == "true";
	includeAs = dataAdd[6] == "true";

	if (bakedTweens && flversion < 13)
	{
		bakedTweens = false;
		trace("WARNING: Baked tweens is not supported on this flash version.\nTry using Flash Pro CC or newer.");
	}
	
	var fileuri = FLfile.platformPathToURI(xPan.saveBox);

	optimizeDimensions = (optDimens == "true");
	optimizeJson = (optAn == "true");
	//flattenSkewing = (flatten == "true");
	allowRotation = (allRot == "true");
	resolution = parseFloat(res);
	resScale =  1 / resolution;

	// Reduce if statements
	key = optimizeJson ? function (a, b) {return b} : function (a, b) {return a};

	// First ask for the export folder
	path = formatPath(fileuri);

	// create da texture atlas folder
	if (!FLfile.exists(path))
		FLfile.createFolder(path);

	measure(function() {
	exportAtlas(symbols);
	});

	// check for scene timelines
	if (tlIndex != doc.currentTimeline)
		doc.currentTimeline = tlIndex;

	// check for symbol timelines
	if (lib.itemExists(curTl.name) && doc.getTimeline().name != curTl.name)
		lib.editItem(curTl.name);

	doc.getTimeline().currentFrame = curFr;
	doc.zoomFactor = curZoom;

	if (resizedContain)
		trace("WARNING: some shapes were resized to fit within the 8192px size limit");

	trace("DONE");
	fl.showIdleMessage(true);
}

function formatPath(path) {
	// TODO: fix the rest of the html special chars crap
	path = path.split("%20").join(" ");
	path = path.split("%27").join("'");
	path = path.split("%5C").join("/");

	var endIndex = path.length - 1;
	while (endIndex >= 0 && path[endIndex] === ' ') {
		endIndex--;
	}

	return path.substring(0, endIndex + 1);
}

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
var bakedTweenedFilters;
var cachedElements;

// Only allow rotation if no movieclip with a filter was baked
// For accuracy reasons
var bakedAFilter;

_main();

function initVars()
{
	SPRITEMAP_ID = "__BTA_TEMP_SPRITEMAP_";
	TEMP_SPRITEMAP = SPRITEMAP_ID + "0";

	frameQueue = [];
	cachedMatrices = [];
	cachedBitmaps = [];
	cachedBitmapsList = new Array();
	cachedTimelineRects = [];
	instanceSizes = [];
	cachedOneFrames = [];
	cachedElements = {};

	lastTimeline = null;
	lastLayer = null;
	lastFrame = null;
	openedSpritemap = false;
	createdLibrary = false;

	dictionary = [];
	bakedDictionary = [];
	smIndex = 0;
	curTweenFrame = -1;

	oneFrameSymbols = {};
	bakedTweenedFilters = {};

	bakedAFilter = false;

	flversion = parseInt(fl.version.split(" ")[1].split(",")[0]);
}

function exportAtlas(symbolNames)
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
		symbol = initBtaItem(containerID);
		lib.editItem(containerID);

		tmpSymbol = true;

		var i = 0;
		var startIndex = 0;

		while(i < symbolNames.length)
		{
			var tempName = symbolNames[i];
			var frameCount = max(findItem(tempName).timeline.frameCount - 1, 1);

			var startFrame = symbol.timeline.layers[0].frames[startIndex];
			startFrame.name = tempName;
			startFrame.labelType = "name";

			symbol.timeline.insertFrames(frameCount, false, startIndex);
			symbol.timeline.currentFrame = startIndex;
			fl.getDocumentDOM().library.addItemToDocument({x: 0.0, y: 0.0}, tempName);

			var element = startFrame.elements[0];
			element.symbolType = "graphic"; // make sure all frames get exported

			startIndex += frameCount;
			i++;

			if (i <= symbolNames.length)
				symbol.timeline.insertBlankKeyframe(startIndex);
		}

		if (symbol.timeline.frameCount > 1)
			symbol.timeline.removeFrames(symbol.timeline.frameCount - 1);
	}

	TEMP_ITEM = initBtaItem(TEMP_SPRITEMAP);
	TEMP_TIMELINE = TEMP_ITEM.timeline;
	TEMP_LAYER = TEMP_TIMELINE.layers[0];
	TEMP_TIMELINE.removeFrames(0,0);
	lib.editItem(TEMP_SPRITEMAP);

	ogSym = symbol;

	// Failsafe for invalid export paths
	if (path.indexOf("unknown|") !== -1)
	{
		var defaultOutputFolder = scriptFolder+"/bta_output";
		FLfile.createFolder(defaultOutputFolder);

		path = (defaultOutputFolder + "/" + ogSym.name);
		FLfile.createFolder(path);

		trace("ERROR: Invalid output path, export redirected to " + path);
	}

	//measure(function () {

	// Clear up previous texture atlas files
	if (FLfile.exists(path + '/Animation.json'))
	{
		FLfile.remove(path + '/Animation.json');

		var smFileIndex = 1;
		while (FLfile.exists(path + '/spritemap' + smFileIndex + '.json'))
		{
			FLfile.remove(path + '/spritemap' + smFileIndex + '.json');
			smFileIndex = smFileIndex + 1;
		}
	}

	// Write Animation.json
	FLfile.write(path + "/Animation.json", generateAnimation(symbol));

	TEMP_LAYER.layerType = "normal";
	TEMP_TIMELINE.currentLayer = 0;

	var i = 0;
	while (i < frameQueue.length)
	{
		var elemIndices = frameQueue[i];
		var matrix = cachedMatrices[i];
		var frame = TEMP_LAYER.frames[i];

		var scaleX = 1 / matrix.a;
		var scaleY = 1 / matrix.d;
		
		TEMP_TIMELINE.currentFrame = i;

		if (doc.selection.length > 0)
			doc.selectNone();

		var selection = new Array();
		var frameFilters = new Array();

		// Remove frame filters (only from Animate 2020 upwards)
		if (flversion >= 20)
		{
			var foundFilters = getFrameFilters(TEMP_LAYER, i);
			if (foundFilters.length > 0) {
				if (!bakedFilters) {
					TEMP_LAYER.setFiltersAtFrame(i, new Array(0));
				}
				else if (frame.elements.length == 1 && frame.elements[0].symbolType == "movie clip") {
					var applyFilters = new Array();
					var fi = 0;
					while (fi < foundFilters.length) {
						var filter = foundFilters[fi++];
						if (filter.name == "blurFilter")
							frameFilters.push(filter)
						else
							applyFilters.push(filter);
					}
					TEMP_LAYER.setFiltersAtFrame(i, applyFilters);
				}
			}
		}

		var e = 0;
		var elements = frame.elements;
		while (e < elements.length)
		{
			var element = elements[e];
			var exportElem = elemIndices.indexOf(e) !== -1;

			if (exportElem)
			{
				// TODO: reimplement baked skews
				element.rotation = 0;
				element.skewX = 0;
				element.skewY = 0;

				if (element.blendMode != null)
					element.blendMode = "normal";

				if (element.colorMode != null)
					element.colorMode = "none";

				var tweenFilters = bakedTweenedFilters[i];
				var filters = (tweenFilters != null) ? tweenFilters : element.filters;
				filters = (filters == null) ? frameFilters : filters.concat(frameFilters);

				if (filters != null && filters.length > 0)
				{
					doc.selectNone();
					element.selected = true;
		
					if (bakedFilters) {
						forEachFilter(filters, function (filter) {
							switch (filter.name)
							{
								case "glowFilter":
								case "blurFilter":
									filter.blurX /= matrix.a;
									filter.blurY /= matrix.d;
									bakedAFilter = true; // only apply for blur type filters
								break;
							}
						});
						doc.setFilters(filters);
					}
					else {
						doc.setFilters(new Array(0));
					}
				}
				else
				{
					if (element.elementType == "shape") // check if the shape has lines and is scaled
					{
						if (checkShapeLines(element, scaleX, scaleY))
							element = frame.elements[e];
					}
				}
			}
			else
			{
				selection[selection.length] = element;
			}

			e++;
		}

		if (selection.length > 0)
		{
			doc.selectNone();
			doc.selection = selection;
			doc.deleteSelection(); // TODO: this sometimes causes crashes on CS6 downwards, look into it
		}


		// make each limb a group so its easier to prepare it for export, normal shapes tend to corrupt easily
		doc.selectNone();

		//var canGroup = true;
		var lastFrame = TEMP_LAYER.frames[i-1];
		var canGroup = true

		if (frame.tweenType == "shape" || (lastFrame != null && lastFrame.tweenType == "shape"))
			canGroup = false;

		if (canGroup) {
			doc.selectAll();
			doc.group();
		}
		
		// apply the scale
		var group = frame.elements[0];
		group.scaleX = scaleX;
		group.scaleY = scaleY;

		// after the size is recalculated, make sure its pixel perfect
		group.scaleX = (scaleX * Math.ceil(group.width) / group.width);
		group.scaleY = (scaleY * Math.ceil(group.height) / group.height);

		// make sure the element is inside the render bounds of the spritesheet exporter
		// also helps a bit with float point accuracy
		group.x = group.width / 2;
		group.y = group.height / 2;

		doc.selectNone();

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

		var sheet = legacySpritesheet(shapeLength, sheetFrame);
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

			exportSpritemap(id, path, spritemaps[i], exportId);
			i++;
		}
	}

	if (tmpSymbol)
		lib.deleteItem(symbol.name);

	trace("Exported to folder: " + FLfile.uriToPlatformPath(path));
}

function checkShapeLines(shape, targetX, targetY)
{
	if (flversion <= 12) // I dont know why this keeps crashing on older flash
		return false;

	if ((Math.abs(targetX - 1) <= 0.01) && (Math.abs(targetY - 1) <= 0.01))
		return false; // doesnt need scaling

	var hasLines = false;
	var edges = shape.edges;

	var i = 0;
	var len = edges.length;
	while (i < len)
	{
		var stroke = edges[i++].stroke;
		if ((stroke != null) && (stroke.style != "noStroke")) {
			hasLines = true;
			break;
		}
	}
    
	if (!hasLines)
		return false; // doesnt have lines

	doc.selectNone();
	doc.selection = [shape];
	doc.convertLinesToFills();
	doc.selectNone();

	return true;
}

function cleanElement(elem)
{
	elem.scaleX = elem.scaleY = 1;

	//if (flattenSkewing)
	//	return;

	elem.rotation = 0;
	elem.skewX = elem.skewY = 0;
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

	if (framesLength === 1)
	{
		alert("ERROR: A shape couldn't fit inside the spritemap");
		return;
	}

	var nextSmID = SPRITEMAP_ID + spritemaps.length;
	lib.addNewItem("graphic", nextSmID);
	var nextSmSymbol = findItem(nextSmID);

	var cutFrames = Math.floor(framesLength * 0.5);
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
	var smSettings = {format: "png", bitDepth: bitDepth, backgroundColor: "#00000000"};
	var sm = smData.sm;

	var exportSheet = function () {
		//if (FLfile.exists(smPath + ".png"))	 FLfile.remove(smPath + ".png")
		//if (FLfile.exists(smPath + ".json")) FLfile.remove(smPath + ".json")
		sm.exportSpriteSheet(smPath, smSettings, true);
	}

	exportSheet();

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

		var w = smWidth + BrdPad;
		var h = smHeight + BrdPad;

		sm.autoSize = false;
		sm.sheetWidth = w;
		sm.sheetHeight = h;

		// this shouldnt happen (most of the time)
		// but just in case, fuck it
		var hasOverflowed = false
		while (sm.overflowed)
		{
			w += 2;
			h += 2;

			if (w > 8192 || h > 8192) {
				hasOverflowed = true;
				trace("ERROR: Couldn't trim spritemap" + index +" correctly");
				break;
			}

			sm.sheetWidth = w;
			sm.sheetHeight = h;
		}

		if (!hasOverflowed) {
			exportSheet();
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
		
		var x = parseInt(frameValues[0].substring(4, frameValues[0].length));
		var y = parseInt(frameValues[1].substring(4, frameValues[1].length));
		var w = parseInt(frameValues[2].substring(4, frameValues[2].length));
		var h = parseInt(frameValues[3].substring(4, frameValues[3].length));

		// expand frame to reduce sharp edges
		x -= 1; y -= 1;
		w += 2; h += 2;
		
		frameValues[0] = '"x":' + x;
		frameValues[1] = '"y":' + y;
		frameValues[2] = '"w":' + w;
		frameValues[3] = '"h":' + h;

		smJson.push('{"SPRITE":{"name":"' +  name + '",' + frameValues.join(",") + ',' + rotated + '}}');
		if (l < atlasLimbs.length - 1) smJson.push(',\n');
		l++;
	}

	smJson.push(']},\n"meta":');

	var metaData = atlasLimbs.pop().split('"meta":')[1];
	metaData = metaData.split(sm.app.split(" ").join("")).join(sm.app + " (Better TA Extension)");
	smJson.push(metaData.split('"scale":"1"').join('"resolution":"' + resolution + '"').slice(0, -1));

	FLfile.write(smPath + ".json", smJson.join(""));

	lib.deleteItem(id);
}

function makeSpritemap() {
	var sm = new SpriteSheetExporter;
	sm.layoutFormat = "JSON-Array";
	sm.algorithm = (flversion <= 12) ? "basic" : algorithm;
	sm.autoSize = true;
	sm.borderPadding = max(BrdPad, 1);
	sm.shapePadding = max(ShpPad, 1);
	sm.allowRotate = allowRotation && !bakedAFilter;
	sm.allowTrimming = true;
	sm.stackDuplicate = true;
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
		curTweenFrame = 0;
		jsonHeader(key("StageInstance", "STI"));
		parseSymbolInstance(instance);
		curTweenFrame = -1;
		push('},\n');
	}

	jsonStr(key("SYMBOL_name", "SN"), formatSymbolName(symbol.name));
	jsonHeader(key("TIMELINE", "TL"));
	parseSymbol(symbol);
	push('}');

	var animJson;

	var makeBitmaps = function () {
		var i = 0;
		while (i < cachedBitmapsList.length) {
			makeBitmapItem(cachedBitmapsList[i++]);
		}
	}

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
				jsonStr(key("SYMBOL_name", "SN"), formatSymbolName(curSymbol));
				jsonHeader(key("TIMELINE", "TL"));
				parseSymbol(symbol);
				push('},');
			}

			makeBitmaps();
			
			dictIndex = 0;
			while (dictIndex < bakedDictionary.length)
			{
				var bakedSymbol = bakedDictionary[dictIndex++];
				push(bakedSymbol.json);
				push(',');
			}

			removeTrail(1);
			push(']}');
		}
		else
		{
			push("}");
			animJson = closeJson();
			ensureLibrary();

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
	
				writeLibraryFile(symbolName, jsonContent, "json");
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

			makeBitmaps();

			dictIndex = 0;
			while (dictIndex < bakedDictionary.length)
			{
				var symbol = bakedDictionary[dictIndex++];
				pushSymbolLibrary(symbol.name, symbol.json);
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
	var accName = doc.name.split(".");
	accName.pop();

	jsonStr(key("version", "V"), BTA_version);
	jsonStr(key("name", "N"), accName.join("."));
	jsonStr(key("backgroundColor", "BGC"), doc.backgroundColor);
	jsonVar(key("width", "W"), doc.width);
	jsonVar(key("height", "H"), doc.height);
	jsonVar(key("asVersion", "ASV"), doc.asVersion);
	jsonVarEnd(key("framerate", "FRT"), doc.frameRate);
}

function pushFilteredFrame(timeline, layerIndex, frameIndex, frameFilters)
{
	var filteredFrame = timeline.layers[layerIndex].frames[frameIndex];

	if (filteredFrame.startFrame == frameIndex) {
		var elementIndices = [];
		var elementsLength = filteredFrame.elements.length;
		var i = 0;
		while (i < elementsLength) {
			elementIndices.push(i++);
		}
		pushElementsFromFrame(timeline, layerIndex, frameIndex, elementIndices, filteredFrame.startFrame + filteredFrame.duration);
	}

	// TODO: add blur filter compression

	var bounds = getFrameBounds(TEMP_TIMELINE, smIndex);
	//expandBounds(bounds, frameFilters);
	
	var atlasMatrix = makeMatrix(1, 0, 0, 1, bounds.left, bounds.top);
	//resizeInstanceMatrix(curSymbol, atlasMatrix); // TODO: add this shit too
	
	push("{");
	parseAtlasInstance(atlasMatrix, smIndex);
	push("}");
	
	smIndex++;
}

function pushOneFrameSymbol(symbolInstance, timeline, layerIndex, frameIndex, elemIndex)
{
	var item = symbolInstance.libraryItem;
	var name = item.name;

	if (oneFrameSymbols[name] != null)
		return;

	oneFrameSymbols[name] = smIndex;
	pushElementsFromFrame(timeline, layerIndex, frameIndex, [elemIndex]);
	cleanElement(TEMP_LAYER.frames[smIndex].elements[elemIndex]);
	smIndex++;
}

var cachedOneFrames;

function isOneFrame(itemTimeline)
{
	if (!bakeOneFR)
		return false;

	var id = itemTimeline.name;

	if (cachedOneFrames[id] != null)
		return cachedOneFrames[id];

	var result = false;
	var layers = itemTimeline.layers;

	var usedLayers = [];
	var usedLayerCount = 0;
	var l = 0;
	while (l < layers.length) {
		var layer = layers[l];
		if (layer.layerType == "normal") {
			usedLayers.push(l);
			usedLayerCount++;
		}
		l++;
	}
	
	if (itemTimeline.frameCount === 1) // Basic one frame check
	{
		if (usedLayerCount > 1) {
			result = true;
		} else {
			var frame = layers[0].frames[0];
			result = frame.elements.length > 1;
		}
	}
	else if (usedLayerCount == 1) // "Advanced" one frame check, maybe should make it a setting because i can see this being a bit costy
	{
		var usedLayer = layers[usedLayers[0]];
		result = isBakeableTimeline(usedLayer.frames[0].startFrame, itemTimeline);
	}

	cachedOneFrames[id] = result;
	return result;
}

function isBakeableTimeline(targetKeyframe, timeline)
{
	var l = 0;
	var layers = timeline.layers;
	while (l < layers.length)
	{
		var layer = layers[l++];
		var f = 0;
		while (f < layer.frames.length)
		{
			var frame = layer.frames[f++];

			// Has more than one keyframe
			if (frame.startFrame !== targetKeyframe)
				return false;

			// Has blend mode filter, dont bake
			var frameBlend = getFrameBlend(layer, frame.startFrame);
			if (frameBlend != "normal")
				return false;

			var e = 0;
			while (e < frame.elements.length) {
				var element = frame.elements[e++];
				if (element.elementType == "instance" && element.instanceType == "symbol")
				{
					// Has blend mode filter, dont bake
					if (element.blendMode != "normal")
						return false;
					
					// Check if element can be cached in one frame
					if (element.symbolType == "graphic") {
						if (!isOneFrame(element.libraryItem.timeline))
							return false;
					}
				}
				else if (element.elementType == "shape" && element.isGroup && element.members.length > 0)
					return false;
			}
		}
	}

	return true;
}

function parseSymbol(symbol)
{
	var timeline = symbol.timeline;
	var layers = timeline.layers;

	jsonArray(key("LAYERS", "L"));

	if (isOneFrame(timeline) && oneFrameSymbols[symbol.name] != null)
	{
		makeBasicLayer(function () {
			var index = oneFrameSymbols[symbol.name];
			var bounds = getFrameBounds(timeline, 0);
			var scale = getMatrixScale(bounds.right - bounds.left, bounds.bottom - bounds.top);
			var matrix = makeMatrix(scale, 0, 0, scale, bounds.left, bounds.top);

			resizeInstanceMatrix(curSymbol, matrix);
			parseAtlasInstance(matrix, index);
		}, timeline.frameCount);
		return;
	}

	var l = 0;
	while (l < layers.length)
	{
		var layer = layers[l];
		var layerType = layer.layerType;

		if (isValidLayer(layer))
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

function makeBasicFrame(elementCallback, index, duration)
{
	push('{');
	jsonVar(key("index", "I"), index);
	jsonVar(key("duration", "DU"), duration);
	jsonArray(key("elements", "E"));
	push('{');
	if (elementCallback != null)
		elementCallback();
	push('}]}');
}

function makeBasicLayer(elementCallback, duration) {
	push('{');
	jsonStr(key("Layer_name", "LN"), "Layer 1");
	jsonArray(key("Frames", "FR"));
	makeBasicFrame(elementCallback, 0, duration);
	push(']}]}');
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
		var isKeyframe = (f === frame.startFrame);
		
		var tweenType = frame.tweenType;
		var isTweenedFrame = (tweenType != "none");
		var canBeTween = isTweenedFrame && (frame.tweenObj != null);
		var bakeTween = canBeTween ? ((tweenType == "shape") || bakedTweens) : false; // force bake shape tweens
		
		// setup for baked tweens crap
		if (curTweenFrame > -1)
		{
			curTweenMatrix = null;
			curTweenColorTransform = null;
			curTweenFilters = null;
			curTweenFrame = -1;
		}

		var frameFilters = getFrameFilters(timeline.layers[layerIndex], f);
		var bakeFrameFilters = bakedFilters && frameFilters.length > 0;

		if (isKeyframe || bakeTween || bakeFrameFilters)
		{
			if (canBeTween && bakeTween) {
				if (isKeyframe) {
					var isShapeTween = (tweenType == "shape");
					if (isShapeTween) // parse shape tween type
					{
						var tweenLength = parseShapeTween(frame, timeline, layerIndex);
						f += tweenLength;
						continue;
					}
				}
				else // parse other tween types
					setupBakedTween(frame, f);
			}

			push('{\n');

			if (frame.name.length > 0)
				jsonStr(key("name", "N"), frame.name);

			if (canBeTween && !bakeTween)
			{
				jsonHeader(key("tween", "TWN"));

				var eases = frame.getCustomEase();
				var isCubic = eases != null;
				if (isCubic)
				{
					jsonArray(key("curve", "CV"));
					var e = 0;
					while (e < eases.length)
					{
						var field = eases[e++];
						push('{"x":' + field.x +
						',"y":' + field.y + "},\n");
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
						jsonStr(key("type", "TP"), key("motion", "MT"));
						jsonStr(key("rotate", "RT"), frame.motionTweenRotate);
						jsonVar(key("rotateTimes", "RTT"), frame.motionTweenRotateTimes);
						jsonVar(key("scale", "SL"), frame.motionTweenScale);
						jsonVar(key("snap", "SP"), frame.motionTweenSnap);
						jsonVarEnd(key("sync", "SC"), frame.motionTweenSync);
					break;
					case "motion object":
						jsonStr(key("type", "TP"), key("motion_OBJECT", "MTO"));
						parseMotionObject(xmlToObject(frame.getMotionObjectXML()));
					break;
					case "IK pose":
						removeTrail(2); // TODO: look where the IK pose tween variables are stored
					break;
					case "shape": break; // unused, shape tweens are force baked
				}	
	
				push("},\n");
			}

			if (includeSnd && frame.soundLibraryItem != null)
			{
				ensureLibrary();
				
				var ext = (frame.soundLibraryItem.originalCompressionType == "RAW") ? ".wav" : ".mp3";
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

			if (includeAs && frame.actionScript != null && frame.actionScript.length > 0)
				parseActionScript(frame, layerIndex, timeline);

			jsonVar(key("index", "I"), f);

			var frameDuration = (bakeTween || bakeFrameFilters) ? 1 : frame.duration;
			jsonVar(key("duration", "DU"), frameDuration);

			var frameBlend = getFrameBlend(timeline.layers[layerIndex], f);
			if (frameBlend != null && frameBlend != "normal")
				jsonVar(key("blend", "B"), parseBlendMode(frameBlend));

			var frameColorTransform = getFrameColorTransform(timeline.layers[layerIndex], f);
			if (frameColorTransform != null)
				parseColorTransform("advanced", frameColorTransform, null);
			
			if (!bakedFilters && frameFilters.length > 0) {
				parseFilters(frameFilters);
				removeTrail(1);
				push(",");
			}

			curFrameMatrix = (hasRig) ? layer.getRigMatrixAtFrame(f) : null;
			parseElements(frame.elements, f, layerIndex, timeline, frameFilters);
			push('},');
		}
		f++;
	}

	removeTrail(1);
	push(']');
}

function parseShapeTween(keyframe, timeline, layerIndex)
{
	lastTimeline = timeline.name;
	lastLayer = layerIndex;
	lastFrame = -1;

	var du = keyframe.duration;

	timeline.setSelectedLayers(layerIndex, true);
	timeline.copyFrames(keyframe.startFrame, keyframe.startFrame + du + 1);
	TEMP_TIMELINE.pasteFrames(smIndex);
	
	var i = 0;
	var startShape = keyframe.elements[0];
	var endShape = TEMP_LAYER.frames[smIndex + du].elements[0];
	
	// prepare lerp function
	var lerp = function(a, b, r) { return a + r * (b - a); }	
	var easePoints = keyframe.getCustomEase("all");
	if (easePoints != null)
		lerp = function (a, b, r) { return customEase(a, b, r, easePoints); }

	while (i < du)
	{
		// manually calculating the tween position because tweenObj.getShape is slow as FUCK
		var t = i / du;
		var left = lerp(startShape.left, endShape.left, t);
		var top = lerp(startShape.top, endShape.top, t);

		makeBasicFrame(function () {
			var mtx = makeMatrix(1, 0, 0, 1, left, top);
			resizeInstanceMatrix(curSymbol, mtx);
			parseAtlasInstance(mtx, smIndex);
			smIndex++;
		}, keyframe.startFrame + i, 1);
		push((i < du - 1) ? ',\n' : ',');

		i++;
	}

	return du;
}

function parseActionScript(frame, layerIndex, timeline)
{
	ensureLibrary();

	var content = rtrim(frame.actionScript);
	var asId = "AS_" + timeline.name + "_" + layerIndex + "_" + frame.startFrame;

	jsonStr(key("actionScript", "AS"), asId+".as");
	writeLibraryFile(asId, content, "as");
}

var createdLibrary;

function ensureLibrary()
{
	if (createdLibrary)
		return;
	// TODO: if library already exists, remove/clear it first?
	FLfile.createFolder(path + "/LIBRARY");
	createdLibrary = true;
}

function writeLibraryFile(fileName, content, ext)
{
	writeFile(path + "/LIBRARY/" + fileName + "." + ext, content);
}

// This is what pain looks like
// I hope adobe burns to the ground for only allowing this data as a xml
function parseMotionObject(motionData)
{
	// Time Map
	var timemap = motionData.TimeMap;
	jsonHeader(key("timeMap", "TM"));
	jsonVar(key("strength", "S"), timemap.strength);
	jsonStrEnd(key("type", "TP"), timemap.type);
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
		jsonStr("ID", cont.id);
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
			jsonArray(key("keyframes", "KFR"));

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

var startTweenElements;
var curTweenMatrix;
var curTweenColorTransform;
var curTweenFilters;
var curTweenFrame;

function setupBakedTween(frame, frameIndex)
{
	var tweenType = frame.tweenType;
	var frameOffset = (frameIndex - frame.startFrame);
	
	curTweenFrame = frameOffset;

	if (tweenType !== "shape")
	{
		curTweenMatrix = frame.tweenObj.getGeometricTransform(frameOffset);
		curTweenColorTransform = frame.tweenObj.getColorTransform(frameOffset);
		curTweenFilters = frame.tweenObj.getFilters(frameOffset);
	}
}

function parseElements(elements, frameIndex, layerIndex, timeline, frameFilters)
{
	jsonArray(key("elements", "E"));

	if (elements.length <= 0) // skip calculating anything lol
	{
		removeTrail(1, "");
		push(']\n');
		return;
	}

	if (bakedFilters) {
		if (frameFilters != null && frameFilters.length > 0) {
			pushFilteredFrame(timeline, layerIndex, frameIndex, frameFilters);
			push(']');
			return;
		}
	}

	var e = 0;
	var shapeQueue = [];
	var layer = timeline.layers[layerIndex];

	//var frameFilters = getFrameFilters(layer, frameIndex);
	//var hasFrameFilters = (bakedFilters && frameFilters.length > 0);
	
	var animType = layer.animationType;
	if (animType == null)
		animType = "none"; // IK pose

	while (e < elements.length)
	{
		var element = elements[e];
		var elementType = element.elementType;
		var isShape = (elementType == "shape");
		var isShapeGroup = isShape && (element.isGroup && element.members.length > 1);

		if (isShapeGroup) {
			isShape = false;
		}
		
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
			case "shape":
				if (isShapeGroup) {
					parseShapeGroup(timeline, layerIndex, frameIndex, e, element);
				}
			break;
			case "instance":
				switch (element.instanceType) {
					case "symbol":

					var hasFilters = element.filters != undefined && element.filters.length > 0;
					var bakeInstanceFilters = (bakedFilters && hasFilters);
					var bakeInstanceType = (element.symbolType == "screen");
					var bakeInstanceSkew = false;//(flattenSkewing && (element.skewX != 0 || element.skewY != 0));
					var bakeInstance = (bakeInstanceFilters || bakeInstanceSkew || bakeInstanceType);
					
					if (bakeInstance)
					{
						pushElementSpritemap(timeline, layerIndex, frameIndex, [e]);
					}
					else
					{
						if (isOneFrame(element.libraryItem.timeline) && animType == "none")
						{
							pushOneFrameSymbol(element, timeline, layerIndex, frameIndex, e);
						}

						parseSymbolInstance(element);
					}

					break;
					case "bitmap":
						parseBitmapInstance(element, timeline, layerIndex, frameIndex, e);
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
						//if (!element.useDeviceFonts || bakeTexts)
						if (bakeTexts)
						{
							pushElementSpritemap(timeline, layerIndex, frameIndex, [e]);
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
		parseShape(timeline, layerIndex, frameIndex, shapeQueue);
		push("}");
	}

	push(']');
}

function parseShapeGroup(timeline, layerIndex, frameIndex, elementIndex, group)
{
	initJson();
	parseElements(group.members, frameIndex, layerIndex, timeline);

	curJson[0] = "";
	curJson[1] = "";
	curJson[curJson.length - 1] = "";
	curJson[curJson.length - 2] = "";

	push(closeJson());
}

function parseTextInstance(text)
{
	jsonHeader(key("textFIELD_Instance", "TFI"));
	jsonVar(key("Matrix", "MX"), parseMatrix(text.matrix, true));
	jsonStr(key("text", "TXT"), text.getTextString());
	jsonStr(key("type", "TP"), text.textType);
	
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
	
	if (text.textType != "static")
	{
		var lineType = null;
		switch (text.lineType)
		{
			case "single line": 		lineType = key("single line", "SL"); 				break;
			case "multiline": 			lineType = key("multiline", "ML");			 		break;
			case "multiline no wrap": 	lineType = key("multiline no wrap", "MLN"); 		break;
			case "password": 			lineType = key("password", "PSW"); 					break;
		}
		if (lineType != null)
			jsonStr(key("lineType", "LT"), lineType);	
	}
	
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
var cachedBitmaps;
var cachedBitmapsList;

function makeBitmapItem(name)
{
	var bitmapIndex = cachedBitmaps[name];
	var bitmapMatrix = cachedMatrices[bitmapIndex];
	resizeInstanceMatrix(name, bitmapMatrix);

	initJson();
	push('{\n');

	if (inlineSym) {
		jsonStr(key("SYMBOL_name", "SN"), formatSymbolName(name));
		jsonHeader(key("TIMELINE", "TL"));
	}

	jsonArray(key("LAYERS", "L"));	

	makeBasicLayer(function () {
		parseAtlasInstance(bitmapMatrix, bitmapIndex, true);
	}, 1);

	if (inlineSym)
		push('}');

	bakedDictionary.push({name: name, json: closeJson()});
}

function parseBitmapInstance(bitmap, timeline, layerIndex, frameIndex, elemIndex)
{
	var item = bitmap.libraryItem;
	var name = item.name;

	//item.compressionType = "lossless";

	parseSymbolInstance(bitmap, name);
	pushInstanceSize(name, min(Math.abs(bitmap.scaleX), 1), min(Math.abs(bitmap.scaleY), 1));

	if (cachedBitmapsList.indexOf(name) == -1)
	{
		pushElementsFromFrame(timeline, layerIndex, frameIndex, [elemIndex]);
		cleanElement(TEMP_LAYER.frames[smIndex].elements[elemIndex]);

		cachedBitmapsList.push(name);
		cachedMatrices[smIndex] = makeMatrix(1, 0, 0, 1, 0, 0);
		cachedBitmaps[name] = smIndex;

		smIndex++;
	}
}

function parseShape(timeline, layerIndex, frameIndex, elementIndices)
{
	var shapeBounds = pushShapeSpritemap(timeline, layerIndex, frameIndex, elementIndices);
	if (shapeBounds == null)
		return;
	
	var atlasIndex = smIndex - 1;
	
	var shapeLeft = Number.POSITIVE_INFINITY;
	var shapeTop = Number.POSITIVE_INFINITY;
	var shapeRight = Number.NEGATIVE_INFINITY;
	var shapeBottom = Number.NEGATIVE_INFINITY;

	var s = 0;
	
	while (s < shapeBounds.length)
	{	
		var bounds = shapeBounds[s++];
		shapeLeft = min(shapeLeft, bounds.left);
		shapeTop = min(shapeTop, bounds.top);
		shapeRight = max(shapeRight, bounds.right);
		shapeBottom = max(shapeBottom, bounds.bottom);
	}

	var scale = getMatrixScale(shapeRight - shapeLeft, shapeBottom - shapeTop);
	var mtx = makeMatrix(scale, 0, 0, scale, shapeLeft, shapeTop);
	resizeInstanceMatrix(curSymbol, mtx);
	
	parseAtlasInstance(mtx, atlasIndex);
}

function isShapeRectangle(shape)
{
	var isRectangle = (shape.contours.length == 2) && (shape.vertices.length === 4);
	if (!isRectangle)
		return false;

	if (isRectangle) {
		isRectangle = shape.contours[1].fill.style == "solid";
		if (isRectangle && (!shape.isRectangleObject)) {
			var verts = shape.vertices;

			// TODO: i think the order of verts is random and needs sorting
			var v0 = {x: Math.floor(verts[2].x), y: Math.floor(verts[2].y)};
			var v1 = {x: Math.floor(verts[0].x), y: Math.floor(verts[0].y)};
			var v2 = {x: Math.floor(verts[1].x), y: Math.floor(verts[1].y)};
			var v3 = {x: Math.floor(verts[3].x), y: Math.floor(verts[3].y)};
	
			isRectangle = (
				(Math.abs(v0.x - v3.x) <= 4) &&
				(Math.abs(v1.x - v2.x) <= 4) &&
				(Math.abs(v0.y - v1.y) <= 4) &&
				(Math.abs(v2.y - v3.y) <= 4)
			);
		}
	}

	return isRectangle;
}

var cachedTimelineRects;

function getElementRect(element, overrideFilters)
{
	var minX;
	var minY;
	var maxX;
	var maxY;

	switch (element.elementType)
	{
		case "shape":
		case "text":
			var bounds = element.objectSpaceBounds;
			minX = bounds.left;
			minY = bounds.top;
			maxX = bounds.right;
			maxY = bounds.bottom;
		break;
		case "instance":	
			switch(element.instanceType)
			{
				case "symbol":
					var timeline = element.libraryItem.timeline;
					var frameIndex = (element.firstFrame != undefined) ? element.firstFrame : 0;

					var cachedRect = cachedTimelineRects[timeline.name];
					if (cachedRect != null && cachedRect[frameIndex] != null)
					{
						var frameRect = cachedRect[frameIndex];
						minX = frameRect.left;
						minY = frameRect.top;
						maxX = frameRect.right;
						maxY = frameRect.bottom;
						break;
					}
		
					minX = minY = Number.POSITIVE_INFINITY;
					maxX = maxY = Number.NEGATIVE_INFINITY;	
				
					var l = 0;
					while (l < timeline.layers.length)
					{
						var layer =  timeline.layers[l++];
						if (!isValidLayer(layer) || layer.layerType == "folder")
							continue;

						var frame = layer.frames[frameIndex];
						if (frame == null)
							continue;
						
						var frameElements = frame.elements;
						var e = 0;
						while (e < frameElements.length)
						{
							var elem = getElementRect(frameElements[e++]);
							minX = min(minX, elem.left);
							minY = min(minY, elem.top);
							maxX = max(maxX, elem.right);
							maxY = max(maxY, elem.bottom);
						}
					}

					if (cachedTimelineRects[timeline.name] == null)
						cachedTimelineRects[timeline.name] = [];

					// cache the rect for later
					cachedTimelineRects[timeline.name][frameIndex] = {
						left: minX,
						top: minY,
						right: maxX,
						bottom: maxY
					}

				break;
				case "bitmap":
					minX = element.left;
					minY = element.top;
					maxX = minX + element.width;
					maxY = minY + element.height;
				break;
			}
		break;
	}

	var bounds = {
		left: minX,
		top: minY,
		right: maxX,
		bottom: maxY
	}

	expandBounds(bounds, overrideFilters != null ? overrideFilters : element.filters);

	return bounds;
}

function expandBounds(bounds, filters)
{
	var instanceFilters = new Array();
	if (filters != null && filters.length > 0)
		instanceFilters = instanceFilters.concat(filters);

	forEachFilter(instanceFilters, function (filter) {
		switch (filter.name)
		{
			case "glowFilter":
				if (filter.inner)
					break;
			case "blurFilter":
				var quality = 1.25;
				if (filter.quality == "medium") 	quality = 2.35;
				else if (filter.quality == "high")	quality = 2.9;
				
				var blurX = filter.blurX;
				var blurY = filter.blurY;

				var expansionX = blurX * quality / 2;
                var expansionY = blurY * quality / 2;
				
				bounds.left -= expansionX;
				bounds.top -= expansionY;
				bounds.right += expansionX;
				bounds.bottom += expansionY;
			break;
		}
	});

	return bounds;
}

function isValidLayer(layer) {
	return (layer.visible || !onlyVisibleLayers) && layer.frameCount > 0 && layer.layerType != "guide" && layer.layerType != "guided";
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

function parseAtlasInstance(matrix, index, skipPush)
{
	if (skipPush == null)
		cachedMatrices[index] = matrix;
	
	jsonHeader(key("ATLAS_SPRITE_instance", "ASI"));
	jsonVar(key("Matrix", "MX"), parseMatrix(matrix, false));
	jsonStrEnd(key("name", "N"), index);
	push('}');
}

var lastTimeline;
var lastLayer;
var lastFrame;

function pushElementsFromFrame(timeline, layerIndex, frameIndex, elementIndices, lastFrameIndex)
{
	if (lastFrameIndex == null)
		lastFrameIndex = frameIndex;

	if (timeline.name != lastTimeline) {
		lastTimeline = timeline.name;
		lastLayer = null;
	}

	if (layerIndex != lastLayer) {
		timeline.setSelectedLayers(layerIndex, true);
		lastLayer = layerIndex;
		lastFrame = null;
	}

	if (lastFrame != frameIndex) {
		timeline.copyFrames(frameIndex, lastFrameIndex);
		lastFrame = frameIndex;
	}

	TEMP_TIMELINE.pasteFrames(smIndex);

	if (TEMP_LAYER.frames[smIndex].elements.length <= 0)
		return;
	
	var elemFrame = TEMP_LAYER.frames[smIndex];
	if (elemFrame.tweenType != "none")
		elemFrame.tweenType = "none";
	
	frameQueue.push(elementIndices);
}

function pushElementSpritemap(timeline, layerIndex, frameIndex, elementIndices)
{
	pushElementsFromFrame(timeline, layerIndex, frameIndex, elementIndices);
	var itemName = "_bta_asi_" + smIndex;

	initJson();
	push('{\n');
	
	if (inlineSym) {
		jsonStr(key("SYMBOL_name", "SN"), formatSymbolName(itemName));
		jsonHeader(key("TIMELINE", "TL"));
	}

	jsonArray(key("LAYERS", "L"));

	var elem = TEMP_LAYER.frames[smIndex].elements[elementIndices[0]];
	var elementFilters = curTweenFilters != null ? curTweenFilters : elem.filters;
	
	if (curTweenFilters != null)
		bakedTweenedFilters[smIndex] = curTweenFilters;

	var baseBounds = elem.objectSpaceBounds;
	if (elem.libraryItem != null && elem.symbolType != "screen")
		baseBounds = getFrameBounds(elem.libraryItem.timeline, 0);

	var rect = expandBounds(baseBounds, elementFilters);

	var w = rect.right - rect.left;
	var h = rect.bottom - rect.top;
	
	var matScale = getMatrixScale(w, h);

	var matScaleX = matScale;
	var matScaleY = matScale;

	if (bakedFilters)
	{
		var scaleXMult = 1;
		var scaleYMult = 1;
	
		// Scaling down blurry symbols so antialiasing can do the dirty work later
		forEachFilter(elementFilters, function (filter) {
			switch (filter.name) {
				case "blurFilter":
					var qualityScale = 0.25;
					if (filter.quality == "medium") qualityScale = 0.375;
					if (filter.quality == "low") 	qualityScale = 0.50;
					scaleXMult *= (filter.blurX / (30 * qualityScale));
					scaleYMult *= (filter.blurY / (30 * qualityScale));
				break;
			}
		});
	
		matScaleX *= max(scaleXMult, 1);
		matScaleY *= max(scaleYMult, 1);
	}

	var atlasMatrix = makeMatrix(matScaleX, 0, 0, matScaleY, rect.left, rect.top);

	//if (flattenSkewing)
	//{
	//	var m = elem.matrix;
		//var w = (rect.right - rect.left);
		//var h = (rect.bottom - rect.top);

		// TODO: still kinda innacurate, fix it later
		//atlasMatrix.tx += ((w * m.c)) / 2;
		//atlasMatrix.ty += ((h * m.b)) / 2;
	//}

	cachedElements[smIndex] = true;

	makeBasicLayer(function () {
		resizeInstanceMatrix(curSymbol, atlasMatrix);
		parseAtlasInstance(atlasMatrix, smIndex);
		smIndex++;
	}, 1);

	if (inlineSym)
		push('}');

	var matrix = cloneMatrix(elem.matrix);
	var scaleX = Math.sqrt(matrix.a * matrix.a + matrix.b * matrix.b);
	var scaleY = Math.sqrt(matrix.c * matrix.c + matrix.d * matrix.d);

	if (scaleX !== 0) {
		matrix.a /= scaleX;
		matrix.b /= scaleX;
	}

	if (scaleY !== 0) {
		matrix.c /= scaleY;
		matrix.d /= scaleY;
	}

	bakedDictionary.push({name: itemName, json: closeJson()});
	parseSymbolInstance(elem, itemName, matrix);
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
		// The timeline.getBounds function will take guides and guided layers, even tho we dont want them
		// But it does offer a way to exclude hidden layers, so with some visibility fuckery we can select what layers we want to be exported
		var layerVisibility = [];
		var l = 0;
		while (l < timeline.layers.length) {
			var layer = timeline.layers[l++];
			layerVisibility.push(layer.visible);
			if (layer.layerType != "folder")
				layer.visible = isValidLayer(layer);
		}

		var bounds = timeline.getBounds(frameIndex + 1, false);
		bounds = (bounds === 0) ? {left: 0, top: 0, right: 0, bottom: 0} : bounds;

		l = 0;
		while (l < timeline.layers.length) {
			var layer = timeline.layers[l];
			if (layer.layerType != "folder")
				layer.visible = layerVisibility[l];
			l++;
		}

		return bounds;
	}

	if (timeline.layerCount == 1) {
		var layer = timeline.layers[0];
		var frame = layer.frames[frameIndex];
		if (frame.elements.length == 1)
		{
			return frame.elements[0].objectSpaceBounds;
		}
	}

	var minX = Number.POSITIVE_INFINITY;
	var minY = Number.POSITIVE_INFINITY;
	var maxX = Number.NEGATIVE_INFINITY;
	var maxY = Number.NEGATIVE_INFINITY;

	var foundElements = 0;
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
			foundElements++;

			switch (elem.elementType)
			{
				case "shape":
					var bounds = elem.objectSpaceBounds;
					minX = min(minX, bounds.left);
					minY = min(minY, bounds.top);
					maxX = max(maxX, bounds.right);
					maxY = max(maxY, bounds.bottom);
				break;
				default:
					var rect = getElementRect(elem);
					minX = min(minX, rect.left);
					minY = min(minY, rect.top);
					maxX = max(maxX, rect.right);
					maxY = max(maxY, rect.bottom);
				break;
			}
		}
	}

	if (foundElements <= 0) {
		minX = 0;
		minY = 0;
		maxX = 0;
		maxY = 0;
	}

	return {
		left: minX,
		top: minY,
		right: maxX,
		bottom: maxY
	}
}

function pushShapeSpritemap(timeline, layerIndex, frameIndex, elementIndices)
{
	pushElementsFromFrame(timeline, layerIndex, frameIndex, elementIndices);

	var frameElements = TEMP_LAYER.frames[smIndex].elements;
	if (frameElements.length <= 0)
		return null;
	
	smIndex++;

	var e = 0;
	var l = frameElements.length;
	var lastWidth = Number.NEGATIVE_INFINITY;
	var lastHeight = Number.NEGATIVE_INFINITY;

	var frameBounds = frameElements[0].objectSpaceBounds;
	var shapes = [];

	// no cleanup needed here
	if (frameElements.length === 1)
	{
		var shape = frameElements[0];
		shapes.push({
			left: shape.left,
			top: shape.top,
			right: shape.left + shape.width,
			bottom: shape.top + shape.height
		});
		return shapes;
	}

	while (e < l)
	{
		if (elementIndices.indexOf(e) !== -1)
		{
			e++;
			continue;
		}

		var elem = frameElements[e++];
		elem.x = frameBounds.right+0.5;
		elem.y = frameBounds.bottom+0.5;
		elem.width = 1;
		elem.height = 1;
	}

	e = 0;

	while (e < l)
	{
		if (elementIndices.indexOf(e) !== -1) // Add the actual parts of the array
		{
			var elem = frameElements[e];
			var elemWidth = Math.round(elem.width);
			var elemHeight = Math.round(elem.height);
			
			// Checking because its both the same shape instance but also not?? Really weird shit
			if (elemWidth != lastWidth && elemHeight != lastHeight)
			{
				// Gotta do this because jsfl scripts cant keep track well of instances data and will randomly corrupt values
				shapes.push({
					left: elem.left,
					top: elem.top,
					right: elem.left + elem.width,
					bottom: elem.top + elem.height
				});

				lastWidth = elemWidth;
				lastHeight = elemHeight;
			}
		}

		e++;
	}

	return shapes;
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

function pushInstanceSize(name, scaleX, scaleY)
{
	var scaleX = Math.abs(scaleX);
	var scaleY = Math.abs(scaleY);

	var curInstanceSize = instanceSizes[curSymbol];
	if (curInstanceSize != null)
	{
		scaleX *= curInstanceSize[0];
		scaleY *= curInstanceSize[1];
	}

	if (instanceSizes[name] == null)
	{
		var list = [scaleX, scaleY];
		instanceSizes[name] = list;
	}
	else
	{
		var list = instanceSizes[name];
		list[0] = max(list[0], scaleX);
		list[1] = max(list[1], scaleY);
	}
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

function getFrameColorTransform(layer, frameIndex)
{
	if (flversion >= 20 && layer.getColorTransformAtFrame != null)
	{
		var colorTransform = layer.getColorTransformAtFrame(frameIndex);
		if (colorTransform != null)
			return colorTransform;
	}

	return null;
}

function getFrameBlend(layer, frameIndex)
{
	if (flversion >= 20 && layer.getBlendModeAtFrame != null)
	{
		var blend = layer.getBlendModeAtFrame(frameIndex);
		if (blend != null)
			return blend;
	}

	return "normal";
}

function parseSymbolInstance(instance, itemName, overrideMatrix)
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
		jsonStr(key("SYMBOL_name", "SN"), formatSymbolName(itemName));

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
	{
		var firstFrame = instance.firstFrame;

		if (bakedTweens && curTweenFrame > -1)
		{
			var length = instance.libraryItem.timeline.frameCount;
			switch (instance.loop) {
				case "play once": 		firstFrame = Math.min(firstFrame + curTweenFrame, length); break;
				case "loop": 			firstFrame = firstFrame + curTweenFrame % length;          break;
			}
		}
		
		jsonVar(key("firstFrame", "FF"), firstFrame);
	}

	if (instance.symbolType != undefined) {
		var type;
		switch (instance.symbolType) {
			case "screen":
			case "graphic": 	type = key("graphic", "G"); 	break;
			case "movie clip": 	type = key("movieclip", "MC"); 	break;
			case "button": 		type = key("button", "B"); 		break;
		}
		jsonStr(key("symbolType", "ST"), type);
	}
	else if (bakedInstance) jsonStr(key("symbolType", "ST"), key("movieclip", "MC"));

	jsonVar(key("transformationPoint", "TRP"),
		'{"x":' + rValue(instance.transformationPoint.x) +
		',"y":' + rValue(instance.transformationPoint.y) + "}"
	);

	var colorMode = instance.colorMode;
	var colorValues = instance;
	if (bakedTweens && curTweenColorTransform != null)
	{
		colorMode = "advanced"; // baking the color mode to advanced because im too tired for this shit
	}

	var validColor = colorMode != undefined && colorMode != "none";
	if (validColor)
	{
		if (bakedTweens && curTweenColorTransform != null)
			colorValues = curTweenColorTransform;
	}

	if (validColor)// && !(bakedInstance && bakedFilters))
	{
		parseColorTransform(colorMode, colorValues, instance)
	}

	if (instance.name != undefined && instance.name.length > 0)
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
	else
	{
		var matrix = overrideMatrix != null ? overrideMatrix : instance.matrix;
		jsonVar(key("Matrix", "MX"), parseMatrix(matrix, true));
	}

	if (instance.symbolType != "graphic")
	{
		if (instance.blendMode != null && instance.blendMode != "normal")
			jsonVar(key("blend", "B"), parseBlendMode(instance.blendMode));

		var filters = curTweenFilters != null ? curTweenFilters : instance.filters;
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

function parseColorTransform(colorMode, colorValues, instance)
{
	if (colorMode == "advanced")
	{
		var validColor = (colorValues.colorRedPercent != 100) || (colorValues.colorGreenPercent != 100) || (colorValues.colorBluePercent != 100) || (colorValues.colorAlphaPercent != 100) ||
		(colorValues.colorRedAmount != 0) || (colorValues.colorGreenAmount != 0) || (colorValues.colorBlueAmount != 0) || (colorValues.colorAlphaAmount != 0);
		if (!validColor)
			return;
	}

	jsonHeader(key("color", "C"));
	var modeKey = key("mode", "M");

	switch (colorMode)
	{
		case "brightness":
			jsonStr(modeKey, key("Brightness", "CBRT"));
			jsonVarEnd(key("brightness", "BRT"), colorValues.brightness * 0.01);
		break;
		case "tint":
			jsonStr(modeKey, key("Tint", "T"));
			jsonStr(key("tintColor", "TC"), instance.tintColor);
			jsonNumEnd(key("tintMultiplier", "TM"), instance.tintPercent * 0.01);
		break;
		case "alpha":
			jsonStr(modeKey, key("Alpha", "CA"));
			jsonNumEnd(key("alphaMultiplier", "AM"), colorValues.colorAlphaPercent * 0.01);
		break;
		case "advanced":
			jsonStr(modeKey, key("Advanced", "AD"));
			jsonNumChained(key("RedMultiplier", "RM"), colorValues.colorRedPercent * 0.01);
			jsonNumChained(key("greenMultiplier", "GM"), colorValues.colorGreenPercent * 0.01);
			jsonNumChained(key("blueMultiplier", "BM"), colorValues.colorBluePercent * 0.01);
			jsonNum(key("alphaMultiplier", "AM"), colorValues.colorAlphaPercent * 0.01);
			jsonNumChained(key("redOffset", "RO"), colorValues.colorRedAmount);
			jsonNumChained(key("greenOffset", "GO"), colorValues.colorGreenAmount);
			jsonNumChained(key("blueOffset", "BO"), colorValues.colorBlueAmount);
			jsonNumEnd(key("AlphaOffset", "AO"), colorValues.colorAlphaAmount);
		break;
	}

	push('},\n');
}

function formatSymbolName(name) {
	return name.split('"').join('\\"');
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
		case "hardLight": return 5;
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
				jsonStr(key("type", "TP"), filter.type);
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
				jsonStr(key("type", "TP"), filter.type);
				jsonVar(key("strength", "STR"), filter.strength);
				jsonVar(key("angle", "A"), filter.angle);
				parseGradientEntries(filter.colorArray, filter.posArray);
				jsonVarEnd(key("quality", "Q"), parseQuality(filter.quality));
			break;
			case "gradientGlowFilter":
				jsonStr(n, key("gradientGlowFilter", "GGF"));
				jsonVar(key("blurX", "BLX"), filter.blurX);
				jsonVar(key("blurY", "BLY"), filter.blurY);
				jsonVar(key("inner", "IN"), filter.inner);
				jsonVar(key("knockout", "KK"), filter.knockout);
				jsonVar(key("strength", "STR"), filter.strength);
				jsonStr(key("type", "TP"), filter.type);
				parseGradientEntries(filter.colorArray, filter.posArray);
				jsonVarEnd(key("quality", "Q"), parseQuality(filter.quality));
			break;
		}

		push((i < filters.length - 1) ? '},' : '}\n');
		i++;
	}

	push(']\n');
}

function parseGradientEntries(colorArray, posArray)
{
	jsonArray(key("GradientEntries","GE"));

	var ge = 0;
	while (ge < colorArray.length) {
		var color = colorArray[ge];
		var ratio = posArray[ge] / 255;
		var alpha = 1.0;
		ge++;

		if (String(color).length == 9) {
			alpha = parseInt(String(color).slice(-3)) / 255;
			color = String(color).slice(0, -2);
		}

		push('{\n');
		jsonStr(key("color", "C"), color);
		jsonVar(key("ratio", "R"), ratio);
		jsonVarEnd(key("alpha", "A"), alpha);
		push(ge < colorArray.length ? '},\n' : '}\n');
	}

	push('],\n');
}

function makeMatrix(a, b, c, d, tx, ty) { return {a: a, b: b, c: c, d: d, tx: tx, ty: ty} }
function cloneMatrix(mat) { return makeMatrix(mat.a, mat.b, mat.c, mat.d, mat.tx, mat.ty); }
function copyMatrix(m1, m2) {
	m1.a = m2.a;
	m1.b = m2.b;
	m1.c = m2.c;
	m1.d = m2.d;
	m1.tx = m2.tx;
	m1.ty = m2.ty;
}

function parseMatrix(m, doConcat)
{
	// Concat the matrix
	if (doConcat)
	{
		if (curFrameMatrix != null)
			m = fl.Math.concatMatrix(m, curFrameMatrix);
		
		if (bakedTweens && curTweenMatrix != null)
			m = fl.Math.concatMatrix(m, curTweenMatrix);
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

function jsonVarChained(name, value) { push('"' + name + '":' + value + ','); }
function jsonNumChained(name, value) { jsonVarChained(name, rValue(value)); }

function measure(func)
{
	var last = Date.now();
	func();
	trace("" + ((Date.now() - last) / 1000) + "s");
}

function traceFields(value, makeNewLines)
{
	var traceCrap = "";
	for (var field in value)
	{
		if (field == "brightness" || field == "tintColor" || field == "tintPercent")
			continue;

		traceCrap += field + ": " + value[field] + ", ";
		if (makeNewLines)
			traceCrap += "\n";
	}
	trace(traceCrap);
}

function trace() {
	var items = [];
	var i = 0;
	while (i < arguments.length)
		items.push(String(arguments[i++]));
	fl.trace(items.join(", "));
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

var jsonQueue = undefined;
var curJson = undefined;

function initJson()
{
	if (jsonQueue == null)
		jsonQueue = [];

	jsonQueue.push(curJson);
	curJson = [];
}

function closeJson()
{
	var result = curJson != undefined ? curJson.join("") : "";
	curJson = jsonQueue.pop();
	return result;
}

function push(data)
{
	curJson.push(data);
}

function removeTrail(trail, separator)
{
	if (separator == null)
		separator = "\n";
	curJson[curJson.length -1] = curJson[curJson.length -1].slice(0, -trail) + separator;
}

// not sure if this is 100% accurate, but its good enough
// some stuff stolen from flxanimate lol
function customEase(from, to, r, points)
{
	r = max(0, min(1, r));

	var p0 = points[0];
	var p1 = points[1];
	var p2 = points[2];
	var p3 = points[3];

	function bezier(t) {
		var u = 1 - t;
		var tt = t * t;
		var uu = u * u;
		var uuu = uu * u;
		var ttt = tt * t;
		var ttu = 3 * tt * u;
		var utt = 3 * t * uu;

		var x = uuu * p0.x + utt * p1.x + ttu * p2.x + ttt * p3.x;
		var y = uuu * p0.y + utt * p1.y + ttu * p2.y + ttt * p3.y;
		return {x: x, y: y};
	}

	var tMin = 0, tMax = 1, t, precision = 0.001;
	while (tMax - tMin > precision)
	{
		t = (tMin + tMax) / 2;
		
		var point = bezier(t);
		if (point.x < r)	tMin = t;
		else 				tMax = t;
    }

    var easedPoint = bezier((tMin + tMax) / 2);
    var ease = easedPoint.y;

    return from + ease * (to - from);
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

// copy pasted from haxe lol
function isSpace(s, pos) {
	if (s.length === 0 || pos < 0 || pos >= s.length)
		return false;
	var c = s.charCodeAt(pos);
	return (c > 8 && c < 14) || c === 32;
}

function rtrim(s) {
	var l = s.length;
	var r = 0;
	while (r < l && isSpace(s, l - r - 1))
		r++;
	return (r > 0) ? s.substring(0, l - r) : s;
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

function legacySpritesheet(shapeLength, sheetFrame)
{
    var curX = BrdPad;
    var curY = BrdPad;
    var sheetWidth = 0;
    var maxHeight = 0;
    var maxSheetWidth = 0;
    var maxSheetHeight = 0;
    var packedRectangles = [];
	
	var elem;
	var isFiltered;
	var isRotated;

	for (i = 0; i < 4; i++)
		lib.addItemToDocument({x: 0, y: 0}, TEMP_SPRITEMAP);
	
	var tl = doc.getTimeline();
	tl.currentLayer = 0;
	tl.currentFrame = 0;

	doc.selectNone();
	doc.selectAll();
	doc.clipCopy();

    while (sheetFrame.elements.length < shapeLength)
	{
		doc.clipPaste();
	}

	var updateElemPos = function(ogElem, elem)
	{
		if (ogElem.elementType != "shape") {
			
			var ogElemPos = {x: ogElem.x, y: ogElem.y};

			if (isFiltered) {
				ogElemPos.x += rect.left * ogElem.scaleX;
				ogElemPos.y += rect.top * ogElem.scaleY;
			}

			/*if (isFiltered) {
				ogElemPos.x = rect.left * ogElem.scaleX;
				ogElemPos.y = rect.top * ogElem.scaleY;
			}*/

			if (isRotated) {
				ogElemPos.x -= ogElem.width;
			}
			
			elem.x = Math.floor(curX - ogElemPos.x);
			elem.y = Math.floor(curY - ogElemPos.y);
		}
		else {
			elem.x = Math.floor(curX - ogElem.left);
			elem.y = Math.floor(curY - ogElem.top);
		}
	}

	var sortedIndices = [];

	i = 0;
	while (i < shapeLength)
	{
		var elem = TEMP_LAYER.frames[i].elements[0];
		if (elem == null)
		{
			sortedIndices.push({index: i, width: 1, height: 1, rotated: false});
			i++;
			continue;
		}
		
		var rect = {index: i, width: elem.width, height: elem.height, rotated: false};

		if (rect.height > rect.width)
		{
			var w = rect.width;
			rect.width = rect.height;
			rect.height = w;
			rect.rotated = true;
		}

		sortedIndices.push(rect);
		i++;
	}

	sortedIndices.sort(function(a, b) {
		if (a.height === b.height) {
			return a.width - b.width;
		}
		return a.height - b.height;
	});

	var maxSize = 8192; // CS6 upwards
	if (flversion < 12) // 2880 limit on older versions
		maxSize = 2880;
    
    i = 0;
    while (i < shapeLength)
	{   
		var sortedElem = sortedIndices[i];
		var elemIndex = sortedElem.index;
		var ogElem = TEMP_LAYER.frames[elemIndex].elements[0];

		if (ogElem == null) {
			packedRectangles[elemIndex] = {x:0,y:0,width:1,height:1,rotated:false};
			i++;
			continue;
		}
		
		elem = sheetFrame.elements[elemIndex];
		elem.firstFrame = elemIndex;
		i++;

		isRotated = sortedElem.rotated;
		if (isRotated) {
			ogElem.rotation += 90;
		}

		isFiltered = (ogElem.filters != null && ogElem.filters.length > 0);
		rect = isFiltered ? getElementRect(ogElem) : (ogElem.objectSpaceBounds);
		
		var rectWidth = isFiltered ? (rect.right - rect.left) : ogElem.width;
		var rectHeight = isFiltered ? (rect.bottom - rect.top) : ogElem.height;

		updateElemPos(ogElem, elem);

		var packedRect = {
			x: Math.floor(curX-1),
			y: Math.floor(curY-1),
			width: Math.floor(rectWidth+1),
			height: Math.floor(rectHeight+1),
			rotated: sortedElem.rotated
		}

		packedRectangles[elemIndex] = packedRect;

		curX += Math.floor(rectWidth + ShpPad + 1);
		
		if (curX > maxSize)
		{
			curX = BrdPad;
			curY += maxHeight + ShpPad;
			sheetWidth = maxSize;
			maxHeight = rectHeight;

			updateElemPos(ogElem, elem);
			packedRect.x = Math.floor(curX);
			packedRect.y = Math.floor(curY);
			curX += Math.floor(rectWidth + ShpPad + 1);
		}
		else
		{
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

		if (doc.selection.length > 0)
			doc.deleteSelection();
	}

	initJson();
	push('{"ATLAS":{"SPRITES":[\n');

	var i = 0;
	while (i < packedRectangles.length)
	{
		var rect = packedRectangles[i];
		push('{"SPRITE":{"name":"' + i +
			'","x":' + rect.x + ',"y":' + rect.y +
			',"w":' + rect.width + ',"h":' + rect.height +
			',"rotated":' + rect.rotated +
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
