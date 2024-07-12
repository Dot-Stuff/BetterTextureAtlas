///// CONFIGURATION
fl.outputPanel.clear(); // debug purposes
var symbol = "";
var meshExport = false; // If to use a spritemap or mesh vertex data
var version = "bta_1"; // easy to modify
var onlyVisibleLayers = true;
var optimiseDimensions = true; // TODO: doesnt work yet
var optimizeJson = true; // TODO: theres still some variable names left to change for optimized lmao
var flattenSkewing = false;
var resolution = 1.0;
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
	var ShpPad = 0;
	var BrdPad = 0;
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

	var rawXML = FLfile.read(fl.configURI + "Commands/BTADialog.xml");
	var str = save + "\\" + symbol;
	if (save == "")
		str = symbol;
	
	rawXML = rawXML.split("$FILEURI").join(str);
	rawXML = rawXML.split("$SHP").join(ShpPad);
	rawXML = rawXML.split("$BRD").join(BrdPad);
	rawXML = rawXML.split("$RES").join(res);
	rawXML = rawXML.split("$OPTDIM").join(optDimens);
	rawXML = rawXML.split("$OPTAN").join(optAn);
	rawXML = rawXML.split("$FLAT").join(flatten);

	var xPan = fl.xmlPanelFromString(rawXML);
	
	if (xPan.dismiss == "accept")
	{
		var str = "";
		str = xPan.saveBox;
		
		var arr = str.split("\\");
		var name = arr[arr.length - 1];
		arr.pop();
		save = arr.join("\\");
		ShpPad = xPan.ShpPad;
		BrdPad = xPan.BrdPad;
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
		var path = save;
		
		if (path == null)
		{
			var arr = doc.path.split("/");
			arr.pop();
			path = arr.join("/");
		}
		
		var arr = path.split(":");
		
		path = "file:///" + arr.join("|");
		path = path.split("\\").join("/");
		path += "/" + name;
	
		// Remove leading spaces of the path
		var endIndex = path.length - 1;
		while (endIndex >= 0 && path[endIndex] === ' ') {
			endIndex--;
		}
	
		path = path.substring(0, endIndex + 1);
	
		FLfile.createFolder(path);

		exportAtlas(path, symbol);
		
		FLfile.write(fl.configURI + "Commands/saveBTA.txt", save + "\n" + ShpPad + "\n" + BrdPad +  "\n" + res +  "\n" + optDimens +  "\n" + optAn +  "\n" + flatten);
	}
	else
		fl.trace("operation cancelled");
	
	fl.trace("DONE");
}
else {
	fl.trace("No symbol selected");
}

var TEMP_SPRITEMAP;
var TEMP_ITEM;
var TEMP_TIMELINE;
var TEMP_LAYER;
var smIndex;

var addedItems;
var frameQueue;

function exportAtlas(exportPath, symbolName)
{	
	TEMP_SPRITEMAP = "_ta_temp_sm";
	addedItems = [];
	frameQueue = [];
	smIndex = 0;

	var symbol = findSymbol(symbolName);

	lib.addNewItem("graphic", TEMP_SPRITEMAP);
	TEMP_ITEM = lib.items[lib.findItemIndex(TEMP_SPRITEMAP)];
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
		var isBitmapFrame = typeof id === "string";
		TEMP_TIMELINE.currentFrame = i;

		if (isBitmapFrame)
		{
			lib.addItemToDocument(pos, id);
			if (resolution < 1) {
				var bitmap = TEMP_LAYER.frames[i].elements[0];
				bitmap.scaleX = bitmap.scaleY = resolution;
			}
		}
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
				// TODO: this fucks up the matrix because the shape width is incorrect when its made with lines
				// ill have to apply a offset or something... idk
				doc.selection = [shape];
				doc.convertLinesToFills();

				var elements = TEMP_LAYER.frames[i].elements;
				for (e = 0; e < elements.length; e++) {
					var element = elements[e];
					if (e == id) element.scaleX = element.scaleY = resolution;
				}
			}
		}
		
		i++;
	}

	// Generate Spritemap
	var sm = new SpriteSheetExporter;
	sm.algorithm = "maxRects";
	sm.autoSize = true;
	sm.borderPadding = 3;
	sm.shapePadding = 3;
	sm.allowRotate = true;
	sm.allowTrimming = true;
	sm.stackDuplicate = true;
	sm.layoutFormat = "JSON-Array";

	sm.addSymbol(TEMP_ITEM);
	lib.deleteItem(TEMP_SPRITEMAP);
	
	var smPath = exportPath + "/spritemap1";
	var smSettings = {format:"png", bitDepth:32, backgroundColor:"#00000000"};
	sm.exportSpriteSheet(smPath, smSettings, true);

	// Parse and change json to spritemap format
	var meta = FLfile.read(smPath + ".json");
	meta = meta.split("\t").join("");
	meta = meta.split(" ").join("");

	var atlasLimbs = meta.split(TEMP_SPRITEMAP);
	atlasLimbs.splice(0, 1);

	var smJson = '{"ATLAS":{"SPRITES":[\n';

	var l = -1;
	for each (var limb in atlasLimbs)
	{
		limb = limb.split("{").join("").split("}").join("");
		var limbData = limb.split("\n");
		l++;
		
		var name = formatLimbName(limbData[0].slice(0, -2));
		var frame = limbData[1].split('"frame":').join("");
		var rotated = limbData[2].slice(0, -1);
		
		smJson += '{"SPRITE":{"name":"' + name + '",' + frame + rotated + '}}';
		
		if (l < atlasLimbs.length - 1)
			smJson += ',\n';
	}

	smJson += ']},\n"meta":';

	var metaData = atlasLimbs.pop().split('"meta":')[1];
	smJson += metaData.split("scale").join("resolution").slice(0, -1);
	
	FLfile.write(smPath + ".json", smJson);
	
	doc.exitEditMode();
	fl.trace("Exported to folder: " + exportPath);
}

function generateAnimation(symbol) {
	var json ="{\n";
	
	// Add Animation
	json += jsonHeader(key("ANIMATION", "AN"));
	if (instance != null) {
		json += jsonHeader(key("StageInstance", "STI"));
		json += parseSymbolInstance(instance);
		json += '},\n';
	}
	json += parseSymbol(symbol);
	json += '},\n';
	
	// Get the dictionary
	var dictionary = [];
	findDictionary(symbol, dictionary);
	
	// Add Symbol Dictionary
	json += jsonHeader(key("SYMBOL_DICTIONARY", "SD"));
	json += jsonArray(key ("Symbols", "S"));
	for (d = 0; d < dictionary.length; d++)
	{
		var name = dictionary[d];
		var symbol = lib.items[lib.findItemIndex(name)];
		
		json += '{\n';
		json += parseSymbol(symbol);
		json += (d < dictionary.length - 1) ? '},' : '}';
	}
	json += ']';
	json += '},\n';
	
	// Add Metadata
	json += jsonHeader(key("metadata", "MD"));
	json += jsonStr(key("version", "V"), version);
	json += jsonVarEnd(key("framerate", "FRT"), doc.frameRate);
	json += '}';
	
	json += "}";
	
	return json;
}

function findDictionary(symbol, dictionary)
{	
	for each(var layer in symbol.timeline.layers)
	{
		var f = 0;
		var l = layer.frames.length;
		while (f < l)
		{
			var frame = layer.frames[f];
			if (frame.startFrame == f)
			{
				for each(var element in frame.elements)
				{
					if (element.elementType == "instance")
					{
						var libraryItem = element.libraryItem;
						var itemName = libraryItem.name;
						
						if (dictionary.indexOf(itemName) == -1)
						{
							var itemType = libraryItem.itemType;
							if (itemType == "graphic" || itemType == "movie clip") {
								findDictionary(libraryItem, dictionary);
								dictionary.push(itemName);
							}
						}
					}
				}
			}
			f++;
		}
	}
}

function parseSymbol(symbol)
{
	var json = '';
	var timeline = symbol.timeline;
	
	json += jsonStr(key("SYMBOL_name", "SN"), symbol.name);
	json += jsonHeader(key("TIMELINE", "TL"));
	json += jsonArray(key("LAYERS", "L"));
	
	// Add Layers and Frames
	var l = -1;
	for each (var layer in timeline.layers)
	{
		l++;
		if (onlyVisibleLayers && !layer.visible)
			continue;

		var locked = layer.locked;
		layer.locked = false;
		
		json += '{\n';
		json += jsonStr(key("Layer_name", "LN"), layer.name);
		
		switch (layer.layerType) {
			case "mask":
				json += jsonStr(key("Layer_type", "LT"), "Clipper");
			break;
			case "masked":
				json += jsonStr(key("Clipped_by", "Clpb"), layer.parentLayer.name);
			break;
		}
		
		json += parseFrames(layer.frames, l, timeline);
		json += (l < timeline.layers.length - 1) ? '},' : '}';
		
		layer.locked = locked;
	}
	
	json += ']';
	json += '}';
	
	return json;
}

function parseFrames(frames, layerIndex, timeline)
{
	var json = jsonArray(key("Frames", "FR"));
	
	var startFrames = [];
	
	// We only need startFrames
	for (f = 0; f < frames.length; f++)
	{
		if (f == frames[f].startFrame) {
			startFrames.push(frames[f]);
		}
	}

	for (f = 0; f < startFrames.length; f++)
	{
		var frame = startFrames[f];		
		json += '{\n';
		
		if (frame.name.length > 0)
			json += jsonStr(key("name", "N"), frame.name);
		
		json += jsonVar(key("index", "I"), frame.startFrame);
		json += jsonVar(key("duration", "DU"), frame.duration);
		json += parseElements(frame.elements, frame.startFrame, layerIndex, timeline);
		json += (f < startFrames.length - 1) ? '},' : '}';
	}
	
	json += ']';
	return json;
}

function parseElements(elements, frameIndex, layerIndex, timeline)
{
	var json = jsonArray(key("elements", "E"));
	
	for (e = 0; e < elements.length; e++)
	{
		var element = elements[e];
		
		json += "{\n";
		
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
				}
			break;
			case "text":
			break;
			case "tlfText":
			break;
			case "shapeObj":
			break;
		}

		json += (e < elements.length -1) ? "}," : "}";
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
	
	if (item != undefined)
		json += jsonStr(key("SYMBOL_name", "SN"), item.name);

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
				json += jsonStr(modeKey, "Brightness");
				json += jsonVarEnd("brightness", instance.brightness);
			break;
			case "tint":
				json += jsonStr(modeKey, "Tint");
				json += jsonStr("tintColor", instance.tintColor);
				json += jsonVarEnd("tintMultiplier", instance.tintPercent / 100);
			break;
			case "alpha":
				json += jsonStr(modeKey, "Alpha");
				json += jsonVarEnd("alphaMultiplier", instance.colorAlphaPercent / 100);
			break;
			case "advanced":
				json += jsonStr(modeKey, "Advanced");
				json += jsonVar("RedMultiplier", instance.colorRedPercent / 100);
				json += jsonVar("greenMultiplier", instance.colorGreenPercent / 100);
				json += jsonVar("blueMultiplier", instance.colorBluePercent / 100);
				json += jsonVar("alphaMultiplier", instance.colorAlphaPercent / 100);
				json += jsonVar("redOffset", instance.colorRedAmount);
				json += jsonVar("greenOffset", instance.colorGreenAmount);
				json += jsonVar("blueOffset", instance.colorBlueAmount);
				json += jsonVarEnd("AlphaOffset", instance.colorAlphaAmount);
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

	if (instance.symbolType == "movie clip")
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

				// TODO: filters in optimized mode ugghuf

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
						jsonVar("distance", filter.distance) +
						jsonVar("knockout", filter.knockout) +
						jsonStr("type", filter.type) +
						jsonVar("strength", filter.strength) +
						jsonVar("angle", filter.angle) +
						jsonStr("shadowColor", filter.shadowColor) +
						jsonStr("highlightColor", filter.highlightColor) +
						jsonVarEnd(key("quality", "Q"), parseQuality(filter.quality));
					break;
					case "blurFilter":
						filterName = key("bevelFilter", "BF");
						filterContents =
						jsonVar(key("blurX", "BLX"), filter.blurX) +
						jsonVar(key("blurY", "BLY"), filter.blurY) +
						jsonVarEnd(key("quality", "Q"), parseQuality(filter.quality));
					break;
					case "dropShadowFilter":
						filterName = key("bevelFilter", "DSF");
						filterContents =
						jsonVar(key("blurX", "BLX"), filter.blurX) +
						jsonVar(key("blurY", "BLY"), filter.blurY) +
						jsonVar("distance", filter.distance) +
						jsonVar("knockout", filter.knockout) +
						jsonVar("inner", filter.inner) +
						jsonVar("hideObject", filter.hideObject) +
						jsonVar("strength", filter.strength) +
						jsonVar("angle", filter.angle) +
						jsonStr("shadowColor", filter.color) + // adobe fucked up
						jsonVarEnd(key("quality", "Q"), parseQuality(filter.quality));
					break;
					case "glowFilter":
						filterName = key("bevelFilter", "GF");
						filterContents =
						jsonVar(key("blurX", "BLX"), filter.blurX) +
						jsonVar(key("blurY", "BLY"), filter.blurY) +
						jsonVar("inner", filter.inner) +
						jsonVar("knockout", filter.knockout) +
						jsonVar("strength", filter.strength) +
						jsonStr("color", filter.color) +
						jsonVarEnd(key("quality", "Q"), parseQuality(filter.quality));
					break;
					case "gradientBevelFilter":
						filterName = key("bevelFilter", "GBVF");
						filterContents =
						jsonVar(key("blurX", "BLX"), filter.blurX) +
						jsonVar(key("blurY", "BLY"), filter.blurY) +
						jsonVar("distance", filter.distance) +
						jsonVar("knockout", filter.knockout) +
						jsonStr("type", filter.type) +
						jsonVar("strength", filter.strength) +
						jsonVar("angle", filter.angle) +
						jsonVar("colorArray", parseArray(filter.colorArray)) +
						jsonVarEnd(key("quality", "Q"), parseQuality(filter.quality));
					break;
					case "gradientGlowFilter":
						filterName = key("bevelFilter", "GGF");
						filterContents =
						jsonVar(key("blurX", "BLX"), filter.blurX) +
						jsonVar(key("blurY", "BLY"), filter.blurY) +
						jsonVar("inner", filter.inner) +
						jsonVar("knockout", filter.knockout) +
						jsonVar("strength", filter.strength) +
						jsonVar("colorArray", parseArray(filter.colorArray)) +
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

function findSymbol(name) {
	if (lib.itemExists(name))
		return lib.items[lib.findItemIndex(name)];

	fl.trace("Symbol not found: " + name);
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
	return '"' + name +'":"' + value + '"\n';
}

function jsonStr(name, value) {
	return '"' + name +'":"' + value + '",\n';
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
