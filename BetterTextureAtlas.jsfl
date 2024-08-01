///// CONFIGURATION
fl.outputPanel.clear(); // debug purposes
fl.showIdleMessage(false);

var symbol = "";
var meshExport = false; // If to use a spritemap or mesh vertex data
var BTA_version = "bta_1"; // easy to modify
var onlyVisibleLayers = true;
var optimiseDimensions = true; // TODO: doesnt work yet
var optimizeJson = true; // TODO: theres still some variable names left to change for optimized lmao
var flattenSkewing = false;
var resolution = 1.0;
var platform = fl.version.split(" ")[0];
var version = fl.version.split(" ")[1].split(",");
var ShpPad = 0;
var BrdPad = 0;
/////

var doc = fl.getDocumentDOM();
var lib = doc.library;

var instance = null;
var resScale = 1.0;

if (doc.selection.length > 0)
{
	instance = doc.selection[0];
	symbol = instance.libraryItem.name;
}
else if (lib.getSelectedItems().length > 0)
{
	symbol = lib.getSelectedItems()[0].name;
}

if (symbol.length > 0)
{
	var save = "";
	
	var res = 1.0;
	var optDimens = "true";
	var optAn = "true";
	var flatten = "false";
	
	if (FLfile.exists(fl.configURI + "Commands/saveBTA.txt"))
	{
		var file = FLfile.read(fl.configURI + "Commands/saveBTA.txt").split("\n");
		save = file[0];
		ShpPad = parseInt(file[1]);
		BrdPad = parseInt(file[2]);
		res = parseFloat(file[3]);
		optDimens = file[4];
		optAn = file[5];
		flatten = file[6];
	}
	
	var stuff = "";
	if (version[0] >= 13)
	{
		if (version[0] < 20)
			stuff = fl.getThemeColor("themeAppBackgroundColor");
		else
		{
			stuff = fl.getThemeColor("themeAppBackgroundColor");
			switch(stuff)
			{
					case "#404040": stuff = "#333333"; break;
					case "#262626": stuff = "#1f1f1f"; break;
					case "#B9B9B9": stuff = "#f5f5f5"; break;	
					case "#F2F2F2": stuff = "#ffffff"; break;
			}
		}
	}
	else {
		stuff = "#f0f0f0";
	}

	var config = fl.configURI;

	FLfile.write(config + "Commands/BTATheme.txt", stuff);
	
	var rawXML = FLfile.read(config + "Commands/BTADialog.xml");
	var fileuri = fl.configDirectory + "\\Commands\\" + symbol; // Default to the root commands folder
	if (save != "")
	{
		var arr = save.split("\\");
		arr.pop();
		fileuri = arr.join("\\") + "\\" + symbol;
	}
	
	rawXML = rawXML.split("$CONFIGDIR").join(fl.configDirectory);
	rawXML = rawXML.split("$FILEURI").join(fileuri);
	rawXML = rawXML.split("$SHP").join(ShpPad);
	rawXML = rawXML.split("$BRD").join(BrdPad);
	rawXML = rawXML.split("$RES").join(res);
	rawXML = rawXML.split("$OPTDIM").join(optDimens);
	rawXML = rawXML.split("$OPTAN").join(optAn);
	rawXML = rawXML.split("$FLAT").join(flatten);
	
	var buttonWidth = 0;
	if (parseInt(version[0]) >= 20)
		buttonWidth = 50;
	
	rawXML = rawXML.split("$BWI").join(buttonWidth);
	
	var xPan = null;
	
	// Flash doesnt support direct panels from strings so we gotta create a temp xml
	if (parseInt(version[0]) < 15 && parseInt(version[1]) < 1)
	{
		var tempP = config + "Commands/_BTAD.xml";
		FLfile.write(tempP, rawXML, null);
		xPan = fl.xmlPanel(tempP);
		FLfile.remove(tempP);
	}
	else
	{
		xPan = fl.xmlPanelFromString(rawXML);
	}	
	
	if (xPan == null)
	{
		alert("Failed loading XML Panel");
	}
	else if (xPan.dismiss == "accept")
	{		
		ShpPad = parseInt(xPan.ShpPad);
		BrdPad = parseInt(xPan.BrdPad);
		res = xPan.ResSld;
		optDimens = xPan.OptDimens;
		optAn = xPan.OptAn;
		flatten = xPan.FlatSke;
		
		optimiseDimensions = (optDimens == "true");
		optimizeJson = (optAn == "true");
		flattenSkewing = (flatten == "true");
		resolution = parseFloat(res);
		resScale =  1 / resolution;

		// First ask for the export folder
		var path = formatPath(fileuri);
	
		FLfile.createFolder(path);
		exportAtlas(path, symbol);
		
		FLfile.write(fl.configURI + "Commands/saveBTA.txt", fileuri + "\n" + ShpPad + "\n" + BrdPad +  "\n" + res +  "\n" + optDimens +  "\n" + optAn +  "\n" + flatten);
	}
	else
	{
		fl.trace("Operation cancelled");
	}
	
	fl.trace("DONE");
	fl.showIdleMessage(true);
}
else {
	alert("No symbol has been selected");
}

var TEMP_SPRITEMAP;
var TEMP_ITEM;
var TEMP_TIMELINE;
var TEMP_LAYER;
var smIndex;

var addedItems;
var frameQueue;

var dictionary;

function exportAtlas(exportPath, symbolName)
{	
	TEMP_SPRITEMAP = "__BTA_TEMP_SPRITEMAP";
	addedItems = [];
	frameQueue = [];
	smIndex = 0;

	dictionary = [];

	var symbol = findItem(symbolName);

	lib.addNewItem("graphic", TEMP_SPRITEMAP);
	TEMP_ITEM = findItem(TEMP_SPRITEMAP);
	TEMP_TIMELINE = TEMP_ITEM.timeline;
	TEMP_LAYER = TEMP_TIMELINE.layers[0];
	TEMP_TIMELINE.removeFrames(0,0);

	// Write Animation.json
	var animJson = generateAnimation(symbol);
	FLfile.write(path + "/Animation.json", animJson);

	// Add items and fix resolutions
	lib.editItem(TEMP_SPRITEMAP);
	var pos = {x:0, y:0};

	var i = 0;
	var l = frameQueue.length;
	while (i < l)
	{
		var id = frameQueue[i];
		var isBitmapFrame = (typeof id === "string");

		if (isBitmapFrame)
		{
			TEMP_TIMELINE.currentFrame = i;
			lib.addItemToDocument(pos, id);
			if (resolution < 1) {
				var bitmap = TEMP_LAYER.frames[i].elements[0];
				bitmap.scaleX = bitmap.scaleY = resolution;
			}
		}
		/* // TODO: this fucks up the matrix and other crap, will fix later
		else if (resolution != 1)
		{
			var shape = TEMP_LAYER.frames[i].elements[id];
			if (shape.isGroup)
			{
				shape.scaleX *= resolution;
				shape.scaleY *= resolution;
			}
			else
			{
				TEMP_TIMELINE.currentFrame = i;
				doc.selection = [shape];
				doc.convertLinesToFills();

				var elements = TEMP_LAYER.frames[i].elements;
				for (e = 0; e < elements.length; e++) {
					var element = elements[e];
					if (e == id) element.scaleX = element.scaleY = resolution;
				}
			}
		}*/
		
		i++;
	}

	// Generate Spritemaps
	var sm = makeSpritemap();
	sm.addSymbol(TEMP_ITEM);

	var spritemaps = [sm];

	if (sm.overflowed) {
		// TODO: divide to other spritemaps
	}
	
	var i = 0;
	while (i < spritemaps.length) {
		exportSpritemap(exportPath, spritemaps[i], i + 1);
		i++;
	}
	
	lib.deleteItem(TEMP_SPRITEMAP);
	doc.exitEditMode();
	
	fl.trace("Exported to folder: " + exportPath);
}

function exportSpritemap(exportPath, sm, index)
{
	var smPath = exportPath + "/spritemap" + index;
	var smSettings = {format:"png", bitDepth:32, backgroundColor:"#00000000"};
	sm.exportSpriteSheet(smPath, smSettings, true);

	// Parse and change json to spritemap format
	var meta = FLfile.read(smPath + ".json").split("\t").join("").split(" ").join("");
	var atlasLimbs = meta.split(TEMP_SPRITEMAP);
	atlasLimbs.splice(0, 1);

	var smJson = '{"ATLAS":{"SPRITES":[\n';

	var l = 0;
	while (l < atlasLimbs.length)
	{
		var limbData = atlasLimbs[l].split("{").join("").split("}").join("").split("\n");

		var name = formatLimbName(limbData[0].slice(0, -2));
		var frame = limbData[1].split('"frame":').join("");
		var rotated = limbData[2].slice(0, -1);
		
		smJson += '{"SPRITE":{"name":"' + name + '",' + frame + rotated + '}}';

		if (l < atlasLimbs.length - 1) smJson += ',\n';
		l++;
	}

	smJson += ']},\n"meta":';

	var metaData = atlasLimbs.pop().split('"meta":')[1];
	smJson += metaData.split("scale").join("resolution").slice(0, -1);
	
	FLfile.write(smPath + ".json", smJson);
}

function makeSpritemap() {
	var sm = new SpriteSheetExporter;
	sm.algorithm = "maxRects";
	sm.autoSize = true;
	sm.borderPadding = BrdPad;
	sm.shapePadding = ShpPad;
	sm.allowRotate = true;
	sm.allowTrimming = true;
	sm.stackDuplicate = true;
	sm.layoutFormat = "JSON-Array";
	return sm;
}

function generateAnimation(symbol)
{
	var json ="{\n";
	
	// Add Animation
	json += jsonHeader(key("ANIMATION", "AN"));
	json += jsonStr(key("name", "N"), doc.name.slice(0, -4));
	if (instance != null) {
		json += 
		jsonHeader(key("StageInstance", "STI")) +
		parseSymbolInstance(instance) +
		'},\n';
	}
	json += parseSymbol(symbol);
	json += '},\n';

	var sdIndex = 1;
	
	// Add Symbol Dictionary
	json += jsonHeader(key("SYMBOL_DICTIONARY", "SD"));
	json += jsonArray(key ("Symbols", "S"));
	while (true)
	{
		var itemName = dictionary[sdIndex];		
		var itemSymbol = findItem(itemName);

		if (itemSymbol == null) {
			break;
		}

		json += '{\n' + parseSymbol(itemSymbol);
		
		if (sdIndex >= dictionary.length - 1)
		{
			json += '}';
			break;
		}
		else
		{
			json += '},';
		}

		sdIndex++;
	}

	json += ']},\n';
	
	// Add Metadata
	json += 
	jsonHeader(key("metadata", "MD")) +
	jsonStr(key("version", "V"), BTA_version) +
	jsonVarEnd(key("framerate", "FRT"), doc.frameRate) +
	'}';
	
	json += "}";
	
	return json;
}

function parseSymbol(symbol)
{
	var json = '';
	var timeline = symbol.timeline;
	var layers = timeline.layers;
	
	json += jsonStr(key("SYMBOL_name", "SN"), symbol.name);
	json += jsonHeader(key("TIMELINE", "TL"));
	json += jsonArray(key("LAYERS", "L"));

	var l = 0;
	while (l < layers.length)
	{
		var layer = layers[l];
		if (layer.visible || !onlyVisibleLayers)
		{
			json += '{\n' +
			jsonStr(key("Layer_name", "LN"), layer.name);

			switch (layer.layerType) {
				case "mask":
					json += jsonStr(key("Layer_type", "LT"), "Clipper");
				break;
				case "masked":
					json += jsonStr(key("Clipped_by", "Clpb"), layer.parentLayer.name);
				break;
				// TODO: add missing layer types
				case "normal": break;
				case "guide": break;
				case "guided": break;
				case "folder": break;
			}

			json += parseFrames(layer.frames, l, timeline) + 
			'},';
		}
		l++;
	}

	return json.slice(0, -1) + ']}';
}

function parseFrames(frames, layerIndex, timeline)
{
	var json = jsonArray(key("Frames", "FR"));

	var f = 0;
	while (f < frames.length)
	{
		var frame = frames[f];
		if (f == frame.startFrame)
		{
			json += '{\n';
		
			if (frame.name.length > 0) {
				json += jsonStr(key("name", "N"), frame.name);
			}
		
			json += jsonVar(key("index", "I"), frame.startFrame);
			json += jsonVar(key("duration", "DU"), frame.duration);
			json += parseElements(frame.elements, frame.startFrame, layerIndex, timeline);
			json += '},';
		}
		f++;
	}

	return json.slice(0, -1) + ']';
}

function parseElements(elements, frameIndex, layerIndex, timeline)
{
	var json = jsonArray(key("elements", "E"));
	
	var e = 0;
	while (e < elements.length)
	{
		var element = elements[e];
		json += "{";
		
		switch (element.elementType) {
			case "shape":
				json += parseShape(element, timeline, layerIndex, frameIndex, e);
			break
			case "instance":
				switch (element.instanceType) {
					case "symbol":
						json += parseSymbolInstance(element);
					break;
					case "bitmap":
						json += parseBitmapInstance(element);
					break;
					// TODO: add missing element instance types
					case "embedded video": break;
					case "linked video": break;
					case "video": break;
					case "compiled clip": break;
				}
			break;
			// TODO:  add missing element types
			case "text": 		break;
			case "tlfText": 	break;
			case "shapeObj": 	break;
		}

		json += (e < elements.length -1) ? "},\n" : "}";
		e++;
	}
	
	json += ']';
	return json;
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
	return parseAtlasInstance(matrix, itemIndex);
}

function parseShape(shape, timeline, layerIndex, frameIndex, elementIndex)
{
	var m = shape.matrix;
	var matrix = {a:m.a * resScale, b:m.b, c:m.c, d:m.d * resScale, tx:m.tx, ty:m.ty};

	if (!shape.isGroup) {
		matrix.tx = parseFloat((shape.x - (shape.width / 2)).toFixed(1));
		matrix.ty = parseFloat((shape.y - (shape.height / 2)).toFixed(1));
	}

	pushElementSpritemap(timeline, layerIndex, frameIndex, elementIndex);
	return parseAtlasInstance(matrix, smIndex - 1);
}

function parseAtlasInstance(matrix, name) {
	return jsonHeader(key("ATLAS_SPRITE_instance", "ASI")) +
	jsonVar(key("Matrix", "MX"), parseMatrix(matrix)) +
	jsonStrEnd(key("name", "N"), name) +
	'}';
}

function pushItemSpritemap(item)
{
	var name = item.name;
	
	if (addedItems.indexOf(name) == -1) {
		TEMP_TIMELINE.insertBlankKeyframe(smIndex);
		addedItems.push(name);
		frameQueue.push(name);
		smIndex;
	}

	return itemQueue[name];
}

function pushElementSpritemap(timeline, layerIndex, frameIndex, elementIndex)
{
	timeline.setSelectedLayers(layerIndex, true);
	timeline.copyFrames(frameIndex, frameIndex);

	TEMP_TIMELINE.insertBlankKeyframe(smIndex);
	TEMP_TIMELINE.pasteFrames();

	var frameElements = TEMP_LAYER.frames[smIndex].elements;	
	var element = frameElements[elementIndex];
	
	// TODO: temp until i fix up lines to fills
	element.scaleX *= resolution;
	element.scaleY *= resolution;
	
	var e = 0;
	while (e < frameElements.length) {
		if (e != elementIndex) {
			var dummy = frameElements[e];
			dummy.width = dummy.height = 0;
			dummy.x = element.x;
			dummy.y = element.y;
		}
		e++;
	}

	frameQueue.push(elementIndex);
	smIndex++;
}

function parseSymbolInstance(instance)
{
	var json = jsonHeader(key("SYMBOL_Instance", "SI"));
	var item = instance.libraryItem;
	
	if (item != undefined) {
		json += jsonStr(key("SYMBOL_name", "SN"), item.name);
		if (dictionary.indexOf(item.name) == -1) {
			dictionary.push(item.name);
		}
	}

	if (instance.firstFrame != undefined)
		json += jsonVar(key("firstFrame", "FF"), instance.firstFrame);
	
	if (instance.symbolType != undefined) {
		var type;
		switch (instance.symbolType) {
			case "graphic": 	type = key("graphic", "G"); 	break
			case "movie clip": 	type = key("movieclip", "MC"); 	break;
			case "button": 		type = key("button", "B"); 		break;
		}
		json += jsonStr(key("symbolType", "ST"), type);
	}	

	if (instance.colorMode != "none") {
		json += jsonHeader(key("color", "C"));
		var modeKey = key("mode", "M");
		
		switch (instance.colorMode) {
			case "brightness":
				json += jsonStr(modeKey, key("Brightness", "CBRT")) +
				jsonVarEnd(key("brightness", "BRT"), instance.brightness);
			break;
			case "tint":
				json += jsonStr(modeKey, key("Tint", "T")) +
				jsonStr(key("tintColor", "TC"), instance.tintColor) +
				jsonVarEnd(key("tintMultiplier", "TM"), instance.tintPercent / 100);
			break;
			case "alpha":
				json += jsonStr(modeKey, key("Alpha", "CA")) +
				jsonVarEnd(key("alphaMultiplier", "AM"), instance.colorAlphaPercent / 100);
			break;
			case "advanced":
				json += jsonStr(modeKey, key("Advanced", "AD")) +
				jsonVar(key("RedMultiplier", "RM"), instance.colorRedPercent / 100) +
				jsonVar(key("greenMultiplier", "GM"), instance.colorGreenPercent / 100) +
				jsonVar(key("blueMultiplier", "BM"), instance.colorBluePercent / 100) +
				jsonVar(key("alphaMultiplier", "AM"), instance.colorAlphaPercent / 100) +
				jsonVar(key("redOffset", "RO"), instance.colorRedAmount) +
				jsonVar(key("greenOffset", "GO"), instance.colorGreenAmount) +
				jsonVar(key("blueOffset", "BO"), instance.colorBlueAmount) +
				jsonVarEnd(key("AlphaOffset", "AO"), instance.colorAlphaAmount);
			break;
		}

		json += '},\n';
	}
	
	if (instance.name.length > 0)
		json += jsonStr(key("Instance_Name", "IN"), instance.name);
	
	if (instance.loop != undefined) {
		var loop;
		switch (instance.loop) {
			case "play once": 		loop = key("playonce", "PO"); 		break;
			case "single frame":	loop = key("singleframe", "SF");	break;
			case "loop": 			loop = key("loop", "LP");
		}
		json += jsonStr(key("loop", "LP"), loop);
	}
	
	if (instance.is3D)
		json += jsonVar(key("Matrix3D", "M3D"), parseMatrix3D(instance.matrix3D));
	else
		json += jsonVar(key("Matrix", "MX"), parseMatrix(instance.matrix));	

	if (instance.symbolType != "graphic")
	{
		var filters = instance.filters;
		var hasFilters = (filters != undefined && filters.length > 0)

		if (instance.blendMode != "normal")
			json += jsonStr(key("blend", "B"), instance.blendMode);
		
		// Add Filters
		if (hasFilters)
		{
			json += jsonArray(key("filters", "F"));

			var i = 0;
			while (i < filters.length)
			{
				var filter = filters[i];
				var filterContents = "";
				var filterName = "";

				switch (filter.name) {
					case "adjustColorFilter":
						filterName = key("adjustColorFilter", "ACF");
						filterContents =
						jsonVar(key("brightness", "BRT"), filter.brightness) +
						jsonVar(key("hue", "H"), filter.hue) + 
						jsonVar(key("contrast", "CT"), filter.contrast) + 
						jsonVarEnd(key("saturation", "SAT"), filter.saturation);
					break;
					case "bevelFilter":
						filterName = key("bevelFilter", "BVF");
						filterContents =
						jsonVar(key("blurX", "BLX"), filter.blurX) +
						jsonVar(key("blurY", "BLY"), filter.blurY) +
						jsonVar(key("distance", "D"), filter.distance) +
						jsonVar(key("knockout", "KK"), filter.knockout) +
						jsonStr(key("type", "T"), filter.type) +
						jsonVar(key("strength", "STR"), filter.strength) +
						jsonVar(key("angle", "A"), filter.angle) +
						jsonStr(key("shadowColor", "SC"), filter.shadowColor) +
						jsonStr(key("highlightColor", "HC"), filter.highlightColor) +
						jsonVarEnd(key("quality", "Q"), parseQuality(filter.quality));
					break;
					case "blurFilter":
						filterName = key("blurFilter", "BF");
						filterContents =
						jsonVar(key("blurX", "BLX"), filter.blurX) +
						jsonVar(key("blurY", "BLY"), filter.blurY) +
						jsonVarEnd(key("quality", "Q"), parseQuality(filter.quality));
					break;
					case "dropShadowFilter":
						filterName = key("dropShadowFilter", "DSF");
						filterContents =
						jsonVar(key("blurX", "BLX"), filter.blurX) +
						jsonVar(key("blurY", "BLY"), filter.blurY) +
						jsonVar(key("distance", "D"), filter.distance) +
						jsonVar(key("knockout", "KK"), filter.knockout) +
						jsonVar(key("inner", "IN"), filter.inner) +
						jsonVar(key("hideObject", "HO"), filter.hideObject) +
						jsonVar(key("strength", "STR"), filter.strength) +
						jsonVar(key("angle", "A"), filter.angle) +
						jsonStr(key("color", "C"), filter.color) +
						jsonVarEnd(key("quality", "Q"), parseQuality(filter.quality));
					break;
					case "glowFilter":
						filterName = key("glowFilter", "GF");
						filterContents =
						jsonVar(key("blurX", "BLX"), filter.blurX) +
						jsonVar(key("blurY", "BLY"), filter.blurY) +
						jsonVar(key("inner", "IN"), filter.inner) +
						jsonVar(key("knockout", "KK"), filter.knockout) +
						jsonVar(key("strength", "STR"), filter.strength) +
						jsonStr(key("color", "C"), filter.color) +
						jsonVarEnd(key("quality", "Q"), parseQuality(filter.quality));
					break;
					case "gradientBevelFilter":
						filterName = key("gradientBevelFilter", "GBVF");
						filterContents =
						jsonVar(key("blurX", "BLX"), filter.blurX) +
						jsonVar(key("blurY", "BLY"), filter.blurY) +
						jsonVar(key("distance", "D"), filter.distance) +
						jsonVar(key("knockout", "KK"), filter.knockout) +
						jsonStr(key("type", "T"), filter.type) +
						jsonVar(key("strength", "STR"), filter.strength) +
						jsonVar(key("angle", "A"), filter.angle) +
						jsonVar(key("colorArray", "CA"), parseArray(filter.colorArray)) +
						jsonVarEnd(key("quality", "Q"), parseQuality(filter.quality));
					break;
					case "gradientGlowFilter":
						filterName = key("gradientGlowFilter", "GGF");
						filterContents =
						jsonVar(key("blurX", "BLX"), filter.blurX) +
						jsonVar(key("blurY", "BLY"), filter.blurY) +
						jsonVar(key("inner", "IN"), filter.inner) +
						jsonVar(key("knockout", "KK"), filter.knockout) +
						jsonVar(key("strength", "STR"), filter.strength) +
						jsonVar(key("colorArray", "CA"), parseArray(filter.colorArray)) +
						jsonVarEnd(key("quality", "Q"), parseQuality(filter.quality));
					break;
				}

				json += '{\n' + jsonStr(key("name", "N"), filterName) + filterContents;
				json += (i < filters.length - 1) ? '},' : '}\n';
				i++;
			}
			
			json += ']\n';
		}
		else json = removeComma(json);
	}
	else json = removeComma(json);

	json += '}';

	return json;
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

function key(normal, optimized) {
	return optimizeJson ? optimized : normal;
}

function jsonVarEnd(name, value) {
	return '"' + name +'":' + value + '\n';
}

function jsonVar(name, value) {
	return '"' + name +'":' + value + ',\n';
}

function jsonStrEnd(name, value) {
	return '"' + name + '":"' + value + '"\n';
}

function jsonStr(name, value) {
	return '"' + name + '":"' + value + '",\n';
}

function jsonArray(name) {
	return '"' + name + '":[\n';
}

function jsonHeader(name) {
	return '"' + name + '":{\n';
}

function removeComma(json) {
	return json.substring(0, json.length - 2) + "\n";
}
