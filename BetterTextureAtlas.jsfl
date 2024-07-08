///// CONFIGURATION
fl.outputPanel.clear(); // debug purposes
var symbol = "";
var meshExport = false; // If to use a spritemap or mesh vertex data
var version = "bta_1"; // easy to modify
var onlyVisibleLayers = true;
var optimiseDimensions = true; // TODO: doesnt work yet
var flattenSkewing = false;

/////

var doc = fl.getDocumentDOM();
var lib = doc.library;

var instance = null;

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
	var res = 1;
	var optDimens = "true";
	var optAn = "true";
	var flatten = "false";
	
	if (FLfile.exists(fl.configURI + "Commands/saveBTA.txt"))
	{
		
		var file = FLfile.read(fl.configURI + "Commands/saveBTA.txt").split("\n");
		save = file[0];
		ShpPad = parseInt(file[1]);
		BrdPad = parseInt(file[2]);
		res = parseInt(file[3]);
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
		flattenSkewing = (flatten == "true");

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
var itemQueue;
var smIndex;

function exportAtlas(exportPath, symbolName)
{	
	TEMP_SPRITEMAP = "_ta_temp_sm";
	itemQueue = {};
	smIndex = 0;

	var symbol = findSymbol(symbolName);

	lib.addNewItem("graphic", TEMP_SPRITEMAP);
	TEMP_ITEM = lib.items[lib.findItemIndex(TEMP_SPRITEMAP)];
	TEMP_TIMELINE = TEMP_ITEM.timeline;
	TEMP_TIMELINE.removeFrames(0,0);

	// Write Animation.json
	var animJson = generateAnimation(symbol);
	FLfile.write(path + "/Animation.json", animJson);

	// Add library items from queue (if any exist)
	lib.editItem(TEMP_SPRITEMAP);
	var pos = {x:0, y:0};
	for (var item in itemQueue) {
		TEMP_TIMELINE.currentFrame = itemQueue[item];
		lib.addItemToDocument(pos, item);
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
	json += '"ANIMATION": {\n';
	if (instance != null) {
		json += '"StageInstance": {\n';
		json += parseSymbolInstance(instance);
		json += '},\n';
	}
	json += parseSymbol(symbol);
	json += '},\n';
	
	// Get the dictionary
	var dictionary = [];
	findDictionary(symbol, dictionary);
	
	// Add Symbol Dictionary
	json += '"SYMBOL_DICTIONARY": {\n';
	json += '"Symbols": [\n';
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
	json += '"metadata": {\n';
	json += jsonStr("version", version);
	json += jsonVarEnd("framerate", doc.frameRate);
	json += '}';
	
	json += "}";
	
	return json;
}

function findDictionary(symbol, dictionary)
{	
	for each(var layer in symbol.timeline.layers)
	{
		var f = -1;
		for each(var frame in layer.frames)
		{
			f++;
			if (f == frame.startFrame)
			{
				for each(var element in frame.elements)
				{
					var type = element.elementType;
					if (type == "instance")
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
		}
	}
}

function parseSymbol(symbol)
{
	var json = '';
	var timeline = symbol.timeline;
	
	json += jsonStr("SYMBOL_name", symbol.name);
	json += '"TIMELINE": {\n';
	json += '"LAYERS": [\n';
	
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
		json += jsonStr("Layer_name", layer.name);
		
		switch (layer.layerType) {
			case "mask":
				json += jsonStr("Layer_type", "Clipper");
			break;
			case "masked":
				json += jsonStr("Clipped_by", layer.parentLayer.name);
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
	var json = '"Frames": [\n';
	
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
			json += jsonStr("name", frame.name);
		
		json += jsonVar("index", frame.startFrame);
		json += jsonVar("duration", frame.duration);
		json += parseElements(frame.elements, frame.startFrame, layerIndex, timeline);
		json += (f < startFrames.length - 1) ? '},' : '}';
	}
	
	json += ']';
	return json;
}

function parseElements(elements, frameIndex, layerIndex, timeline)
{
	var json = '"elements": [\n';
	
	for (e = 0; e < elements.length; e++)
	{
		var element = elements[e];
		
		json += "{\n";
		
		switch (element.elementType) {
			case "shape":
				json += parseAtlasInstance(element, false, e, frameIndex, layerIndex, timeline);
			break
			case "instance":
				switch (element.instanceType) {
					case "symbol":
						json += parseSymbolInstance(element);
					break;
					case "bitmap":
						json += parseAtlasInstance(element, true, e, frameIndex, layerIndex, timeline);
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

function parseAtlasInstance(instance, isItem, elementIndex, frameIndex, layerIndex, timeline)
{
	var json = '"ATLAS_SPRITE_instance": {\n';
	
	if (isItem)
	{
		var itemIndex = pushItemSpritemap(instance.libraryItem);
		
		json += jsonVar("Matrix", parseMatrix(instance.matrix));
		json += jsonStrEnd("name", itemIndex);
	}
	else
	{
		var tx = (instance.x - (instance.width / 2));
		var ty = (instance.y - (instance.height / 2));
		
		json += jsonVar("Matrix", parseMatrix({a:1, b:0, c:0, d:1, tx:tx, ty:ty}));
		json += jsonStrEnd("name", smIndex);
		pushElementSpritemap(timeline, layerIndex, frameIndex, elementIndex);
	}
	
	json += '}';
	return json;
}

function pushItemSpritemap(item)
{
	var name = item.name;
	
	if (itemQueue[name] == null) {
		TEMP_TIMELINE.insertBlankKeyframe(smIndex);
		itemQueue[name] = smIndex;
		smIndex++;
	}

	return itemQueue[name];
}

function pushElementSpritemap(timeline, layerIndex, frameIndex, elementIndex)
{
	timeline.setSelectedLayers(layerIndex, true);
	timeline.copyFrames(frameIndex, frameIndex);

	TEMP_TIMELINE.insertBlankKeyframe(smIndex);
	TEMP_TIMELINE.pasteFrames();

	var frameElements = TEMP_TIMELINE.layers[0].frames[smIndex].elements;	
	if (frameElements.length > 1)
	{
		var e = -1;
		for each (var element in frameElements) {
			e++;
			if (e != elementIndex) {
				element.scaleX = element.scaleY = 0; // very shitty way of hiding the element, i really dont wanna edit the item :(
			}
		}
	}

	smIndex++;
}

function parseSymbolInstance(instance)
{
	var json = '"SYMBOL_Instance": {\n';
	var item = instance.libraryItem;
	
	if (item != undefined)
		json += jsonStr("SYMBOL_name", item.name);

	if (instance.firstFrame != undefined)
		json += jsonVar("firstFrame", instance.firstFrame);
	
	if (instance.symbolType != undefined)
		json += jsonStr("symbolType", instance.symbolType.replace(" ", ""));
	
	json += jsonStr("Instance_Name", instance.name);
	
	if (!instance.is3D)
		json += jsonVar("Matrix", parseMatrix(instance.matrix));
	else
		json += jsonVar("Matrix3D", parseMatrix3D(instance.matrix3D));

	if (instance.symbolType != "graphic")
	{
		json += jsonStr("blendMode", instance.blendMode);
		
		// Add Filters
		json += '"filters": [';
		
		var filters = instance.filters;
		if (filters != undefined) {
			for (i = 0; i < filters.length; i++) {
				var filter = filters[i];
				var name = filter.name;
				json += '\n{\n';
				json += jsonStr("name", name);
				
				switch (name) {
					case "adjustColorFilter":
						json += jsonVar("brightness", filter.brightness);
						json += jsonVar("hue", filter.hue);
						json += jsonVar("contrast", filter.contrast);
						json += jsonVarEnd("saturation", filter.saturation);
					break;
					case "bevelFilter":
						json += jsonVar("blurX", filter.blurX);
						json += jsonVar("blurY", filter.blurY);
						json += jsonVar("distance", filter.distance);
						json += jsonVar("knockout", filter.knockout);
						json += jsonStr("type", filter.type);
						json += jsonVar("strength", filter.strength);
						json += jsonVar("angle", filter.angle);
						json += jsonStr("shadowColor", filter.shadowColor);
						json += jsonStr("highlightColor", filter.highlightColor);
						json += jsonVarEnd("quality", parseQuality(filter.quality));
					break;
					case "blurFilter":
						json += jsonVar("blurX", filter.blurX);
						json += jsonVar("blurY", filter.blurY);
						json += jsonVarEnd("quality", parseQuality(filter.quality));
					break;
					case "dropShadowFilter":
						json += jsonVar("blurX", filter.blurX);
						json += jsonVar("blurY", filter.blurY);
						json += jsonVar("distance", filter.distance);
						json += jsonVar("knockout", filter.knockout);
						json += jsonVar("inner", filter.inner);
						json += jsonVar("hideObject", filter.hideObject);
						json += jsonVar("strength", filter.strength);
						json += jsonVar("angle", filter.angle);
						json += jsonStr("shadowColor", filter.color); // adobe fucked up
						json += jsonVarEnd("quality", parseQuality(filter.quality));
					break;
					case "glowFilter":
						json += jsonVar("blurX", filter.blurX);
						json += jsonVar("blurY", filter.blurY);
						json += jsonVar("inner", filter.inner);
						json += jsonVar("knockout", filter.knockout);
						json += jsonVar("strength", filter.strength);
						json += jsonStr("color", filter.color);
						json += jsonVarEnd("quality", parseQuality(filter.quality));
					break;
					case "gradientBevelFilter":
						json += jsonVar("blurX", filter.blurX);
						json += jsonVar("blurY", filter.blurY);
						json += jsonVar("distance", filter.distance);
						json += jsonVar("knockout", filter.knockout);
						json += jsonStr("type", filter.type);
						json += jsonVar("strength", filter.strength);
						json += jsonVar("angle", filter.angle);
						json += jsonVar("colorArray", parseColorArray(filter.colorArray));
						json += jsonVarEnd("quality", parseQuality(filter.quality));
					break;
					case "gradientGlowFilter":
						json += jsonVar("blurX", filter.blurX);
						json += jsonVar("blurY", filter.blurY);
						json += jsonVar("inner", filter.inner);
						json += jsonVar("knockout", filter.knockout);
						json += jsonVar("strength", filter.strength);
						json += jsonVar("colorArray", parseColorArray(filter.colorArray));
						json += jsonVarEnd("quality", parseQuality(filter.quality));
					break;
				}
				
				json += (i < filters.length - 1) ? '},' : '}\n';
			}
		}
		
		json += ']\n';
	}
	else {
		json = json.substring(0, json.length - 2);
		json += "\n";
	}

	json += '}';

	return json;
}

function parseMatrix(mat) {
	var str = '['
	str += mat.a + ",";
	str += mat.b + ",";
	str += mat.c + ",";
	str += mat.d + ",";
	str += mat.tx + ",";
	str += mat.ty;
	str += "]";
	return str;
}

function parseMatrix3D(mat) {
	var str = '[\n'
	str += mat.m00 + ",";
	str += mat.m01 + ",";
	str += mat.m02 + ",";
	str += mat.m03 + ",";
	str += mat.m10 + ",";
	str += mat.m11 + ",";
	str += mat.m12 + ",";
	str += mat.m13 + ",";
	str += mat.m20 + ",";
	str += mat.m21 + ",";
	str += mat.m22 + ",";
	str += mat.m23 + ",";
	str += mat.m30 + ",";
	str += mat.m31 + ",";
	str += mat.m32 + ",";
	str += mat.m33;
	str += "\n]";
	return str;
}

function parseColorArray(colorArray) {
	return '["' + colorArray.join('","') +'"]';
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

function jsonVarEnd(name, value) {
	return '"' + name +'": ' + value + '\n';
}

function jsonVar(name, value) {
	return '"' + name +'": ' + value + ',\n';
}

function jsonStrEnd(name, value) {
	return '"' + name +'": "' + value + '"\n';
}

function jsonStr(name, value) {
	return '"' + name +'": "' + value + '",\n';
}
