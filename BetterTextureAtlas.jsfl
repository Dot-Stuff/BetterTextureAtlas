///// CONFIGURATION

var symbol = "";
var meshExport = false; // If to use a spritemap or mesh vertex data
var onlyVisibleLayers = true;

/////

var doc = fl.getDocumentDOM();
var lib = doc.library;

var spritemap = [];
var smIndex = 0;

var instance = null;
if (lib.getSelectedItems().length > 0)
{
	symbol = lib.getSelectedItems()[0].name;
}
else if (doc.selection.length > 0)
{
	instance = doc.selection[0];
	symbol = instance.libraryItem.name;
}

if (symbol.length > 0)
{
	// First ask for the export folder
	var path = fl.browseForFolderURL("Select a folder.");
	if (path != null) // not cancelled
	{
		path += "/" + symbol;
		FLfile.createFolder(path);

		exportAtlas(path, symbol);
	}
}
else {
	fl.trace("No symbol selected");
}

function exportAtlas(exportPath, symbolName)
{
	var symbol = findSymbol(symbolName);
	spritemap = [];
	smIndex = 0;
	
	if (!(symbol.itemType == "graphic" || symbol.itemType == "movie clip")) {
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

	//findDictionary
	
	// Add Symbol Dictionary
	json += '"SYMBOL_DICTIONARY": {\n';
	json += '"Symbols": [\n';
	for (d = 0; d < dictionary.length; d++)
	{
		var name = dictionary[d];
		var symbol = lib.items[lib.findItemIndex(name)];
		
		json += '{\n';
		json += parseSymbol(symbol);
		json += (d < dictionary.length - 1) ? '},\n' : '}\n';
	}
	json += ']\n';
	json += '},\n';
	
	// Add Metadata
	json += '"metadata": {\n';
	json += jsonStr("version", "bta_1");
	json += '"framerate": ' + doc.frameRate + "\n";
	json += '}\n';
	
	json += "}";
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
		
		lib.editItem(symbol.name);	
		doc.getTimeline().setSelectedLayers(l);
		doc.selectNone();
		
		json += '{\n';
		json += jsonStr("Layer_name", layer.name);
		json += parseFrames(layer.frames, symbol);
		json += (l < layers.length - 1) ? '},\n' : '}\n';
		
		layer.locked = locked;
	}

	doc.exitEditMode();
	
	json += ']\n';
	json += '}\n';
	
	return json;
}

function parseFrames(frames, symbol)
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

		doc.getTimeline().setSelectedFrames(f, f);
		doc.selectNone();
		
		json += '{\n';
		json += jsonVar("index", frame.startFrame);
		json += jsonVar("duration", frame.duration);
		json += parseElements(frame.elements, frame.startFrame, symbol);
		json += (f < startFrames.length - 1) ? '},\n' : '}\n';
	}
	
	json += ']\n';
	return json;
}

function parseElements(elements, frameIndex, symbol)
{
	var json = '"elements": [\n';
	
	for (e = 0; e < elements.length; e++)
	{
		var element = elements[e];
		var type = element.elementType;
		
		json += "{\n";
		
		if (type == "shape") {
			json += parseShape(element, frameIndex, symbol);
		}
		else if (type == "instance") {
			json += parseSymbolInstance(element);
		}
		else if (type == "text") {
		}
		else if (type == "tlfText") {
		}
		else if (type == "shapeObj") {
		}
			
		json += "}\n";
	
		if (e < elements.length -1) {
			json += ",";
		}
	}
	
	json += ']\n';
	return json;
}

function parseShape(shape, frameIndex, symbol)
{
	var json = '"ATLAS_SPRITE_instance": {\n';

	json += jsonVar("Matrix", parseMatrix(shape.matrix));

	json += '"name": "' + smIndex + '"\n';
	
	// TODO: do this diferently if its mesh mode
	pushShapeSpritemap(shape, frameIndex, symbol);
	
	json += '}\n';
	return json;
}

function pushShapeSpritemap(shape, frameIndex, parentSymbol)
{
	lib.editItem(parentSymbol.name);
	doc.getTimeline().copyFrames(frameIndex, frameIndex);
	
	var temp = "_ta_temp_" + smIndex;
	lib.addNewItem("graphic", temp);
	
	lib.editItem(temp);
	doc.getTimeline().setSelectedFrames(0,0);
	doc.getTimeline().pasteFrames();
	
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
	json += jsonStr("symbolType", instance.symbolType);
	json += jsonVar("Matrix", parseMatrix(instance.matrix));
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
			
			// TODO: implement the rest of the filters
			if (name == "blurFilter")
			{
				json += jsonVar("blurX", filter.blurX);
				json += jsonVar("blurY", filter.blurY);
				json += '"quality": ' + parseQuality(filter.quality) + '\n';
			}
			
			json += (i < filters.length - 1) ? '},' : '}\n';
		}
	}
	
	json += ']\n';
	json += '}\n';

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

function jsonVar(name, value) {
	return '"' + name +'": ' + value + ',\n';
}

function jsonStr(name, value) {
	return '"' + name +'": "' + value + '",\n';
}
