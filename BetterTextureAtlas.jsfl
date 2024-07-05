///// CONFIGURATION
fl.outputPanel.clear(); // debug purposes
var symbol = "";
var meshExport = false; // If to use a spritemap or mesh vertex data
var version = "bta_1"; // easy to modify
var onlyVisibleLayers = true;
var optimiseDimensions = true;
var flattenSkewing = false;

/////

var doc = fl.getDocumentDOM();
var lib = doc.library;

var spritemap = [];
var smIndex = 0;

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
		
		optimiseDimension = optDimens == "true";
		flattenSkewing = flatten == "true";

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

function exportAtlas(exportPath, symbolName)
{
	var symbol = findSymbol(symbolName);
	spritemap = [];
	smIndex = 0;
	
	if (!(symbol.itemType == "graphic" || symbol.itemType == "movie clip")) { // What is this? DM - Cheems
		fl.trace("Invalid symbol type: " + symbol.itemType);
		return;
	}

	// Write Animation.json
	var animJson = generateAnimation(symbol);
	FLfile.write(path + "/Animation.json", animJson);

	// Generate Spritemap
	var sm = new SpriteSheetExporter;
	sm.algorithm = "maxRects";
	sm.autoSize = true;
	sm.borderPadding = 3;
	sm.shapePadding = 3;
	sm.allowRotate = true;
	sm.allowTrimming = true;
	sm.stackDuplicate = true;
	sm.layoutFormat = "JSON";

	if (optimiseDimensions)
	{
		sm.maxSheetWidth = w + (sm.shapePadding * Math.max(smIndex - 1, 0)) + sm.borderPadding; 
		sm.maxSheetHeight = h + (sm.shapePadding * Math.max(smIndex - 1, 0)) + sm.borderPadding;
	}

	// OK this becomes SUPER bullshit but you gotta do what you gotta do

	for (i = 0; i < spritemap.length; i++) {
		var temp = "_ta_temp_" + i;
		var item = lib.items[lib.findItemIndex(temp)];
		sm.addSymbol(item);
		lib.deleteItem(temp);
	}

	var smPath = exportPath + "/spritemap1";
	var smSettings = {format:"png", bitDepth:32, backgroundColor:"#00000000"};
	
	// TODO: metadata is broken and not all shapes seem to be exporting..
	// fix that crap
	var meta = sm.exportSpriteSheet(smPath, smSettings, true);
	//fl.trace(meta);
	
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
	
	doc.exitEditMode();
	return json;
}

function findDictionary(symbol, dictionary)
{
	//fl.trace(symbol.name);
	
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
						
						if (dictionary.indexOf(itemName) == -1) {
							dictionary.push(itemName);
							findDictionary(libraryItem, dictionary);
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
	
	var layers;
	if (onlyVisibleLayers) // We only need the visible layers
	{
		layers = [];
		for (l = 0; l < timeline.layers.length; l++) {
			var layer = timeline.layers[l];
			if (layer.visible)
				layers.push(layer);
		}
	}
	else {
		layers = timeline.layers;
	}
	
	// Add Layers and Frames
	for (l = 0; l < layers.length; l++)
	{
		var layer = layers[l];
		
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
		
		json += parseFrames(layer.frames, l, symbol);
		json += (l < layers.length - 1) ? '},' : '}';
		
		layer.locked = locked;
	}
	
	json += ']';
	json += '}';
	
	return json;
}

function parseFrames(frames, layerIndex, symbol)
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
		json += jsonVar("index", frame.startFrame);
		json += jsonVar("duration", frame.duration);
		json += parseElements(frame.elements, frame.startFrame, layerIndex, symbol);
		json += (f < startFrames.length - 1) ? '},' : '}';
	}
	
	json += ']';
	return json;
}

function parseElements(elements, frameIndex, layerIndex, symbol)
{
	var json = '"elements": [\n';
	
	for (e = 0; e < elements.length; e++)
	{
		var element = elements[e];
		
		json += "{\n";
		
		switch (element.elementType) {
			case "shape":
				json += parseShape(element, frameIndex, layerIndex, symbol);
			break;
			case "instance":
				json += parseSymbolInstance(element);
			break;
			case "text":
			break;
			case "tlfText":
			break;
			case "shapeObj":
			break;
		}
			
		json += "}";
	
		if (e < elements.length -1) {
			json += ",";
		}
	}
	
	json += ']';
	return json;
}

function parseShape(shape, frameIndex, layerIndex, symbol)
{
	var json = '"ATLAS_SPRITE_instance": {\n';

	json += jsonVar("Matrix", parseMatrix(shape.matrix));
	json += jsonStrEnd("name", smIndex);
	
	// TODO: do this diferently if its mesh mode
	pushShapeSpritemap(shape, frameIndex, layerIndex, symbol);
	
	json += '}';
	return json;
}

var w = 0;
var h = 0;
function pushShapeSpritemap(shape, frameIndex, layerIndex, parentSymbol)
{	
	lib.editItem(parentSymbol.name);
	doc.getTimeline().setSelectedLayers(layerIndex);
	doc.getTimeline().copyFrames(frameIndex, frameIndex);
	
	var temp = "_ta_temp_" + smIndex;
	lib.addNewItem("graphic", temp);
	
	lib.editItem(temp);
	doc.getTimeline().setSelectedFrames(0,0);
	doc.getTimeline().pasteFrames();
	
	// Only check if theres too many elements in the shape
	var elementsInShape = doc.getTimeline().layers[0].frames[0].elements.length;
	if (elementsInShape > 1)
	{
		// Remove symbol instances we dont want in the shape symbol
		doc.getTimeline().setSelectedFrames(0,0);
		doc.distributeToLayers();
	
		var f = -1;
		for each (var layer in doc.getTimeline().layers) {
			f++;
			if (lib.itemExists(layer.name)) {
				doc.getTimeline().setSelectedLayers(f);
				doc.getTimeline().clearFrames();
			}
		}
	}
	
	var bs = doc.getTimeline().getBounds(0); // TODO/Reminder: in the future macro symbol, use smIndex instead of 0
	w += bs.width;
	h += bs.height;
	
	spritemap.push(lib.items[lib.findItemIndex(temp)]);
	smIndex++;
}

function parseSymbolInstance(instance)
{
	var json = '"SYMBOL_Instance": {\n';
	var item = instance.libraryItem;
	
	if (item != undefined) {
		json += jsonStr("SYMBOL_name", item.name);
	}

	if (instance.firstFrame != undefined) {
		json += jsonVar("firstFrame", instance.firstFrame);
	}
	
	json += jsonStr("Instance_Name", instance.name);
	json += jsonStr("symbolType", instance.symbolType.replace(" ", ""));
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
	str += "\t" + mat.m00 + ",\n";
	str += "\t" + mat.m01 + ",\n";
	str += "\t" + mat.m02 + ",\n";
	str += "\t" + mat.m03 + ",\n";
	str += "\t" + mat.m10 + ",\n";
	str += "\t" + mat.m11 + ",\n";
	str += "\t" + mat.m12 + ",\n";
	str += "\t" + mat.m13 + ",\n";
	str += "\t" + mat.m20 + ",\n";
	str += "\t" + mat.m21 + ",\n";
	str += "\t" + mat.m22 + ",\n";
	str += "\t" + mat.m23 + ",\n";
	str += "\t" + mat.m30 + ",\n";
	str += "\t" + mat.m31 + ",\n";
	str += "\t" + mat.m32 + ",\n";
	str += "\t" + mat.m33;
	str += "\n]";
	return str;
}

function parseColorArray(colorArray) {
	var str = "[";
	var i = -1;
	for each(var color in colorArray) {
		i++;
		str += '"' + color + '"';
		if (i < colorArray.length - 1) str += ",";
	}
	return str + "]";
}

function parseQuality(quality) {
	if (quality == "low") return 1;
	if (quality == "medium") return 2;
	return 3;
}

function findSymbol(name) {
	var index = lib.findItemIndex(symbol);
	if (index !== -1) {
		return lib.items[index];
	}

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
