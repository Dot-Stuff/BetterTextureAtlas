///// CONFIGURATION

var symbol = "";
var instance = null;
if (doc.library.getSelectedItems().length > 0)
{
	symbol = doc.library.getSelectedItems()[0].name;
}
else if (doc.selection.length > 0)
{
	instance = doc.selection[0];
	
	symbol = instance.libraryItem.name;
}



var meshExport = false; // If to use a spritemap or mesh vertex data

/////
if (symbol != "") // That means nothing was selected
{
	// First ask for the export folder
	var path = fl.browseForFolderURL("Select a folder.");
	if (path != null) // not cancelled
	{
		path += "/" + symbol;
		FLfile.createFolder(path);

		var configDir = fl.configDirectory;
		var doc = fl.getDocumentDOM();
		var lib = doc.library;

		exportAtlas(path, symbol);

		var spritemap = [];
		var smIndex = 0;
	}
}
else
	fl.trace("ERROR: NOTHING IS SELECTED");

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
	fl.trace(meta);
	
	fl.trace("Exported to folder: " + exportPath);
}

function generateAnimation(symbol) {
	var json ="{\n";
	
	// Add Animation
	json += '"ANIMATION": {\n';
	//json += '"StageInstance": {\n';
	//json += parseSymbolInstance(symbol);
	//json += '},\n';
	json += parseSymbol(symbol);
	json += '},\n';
	
	// Get the dictionary
	var dictionary = findDictionary(symbol, []);
	
	// Add Symbol Dictionary
	json += '"SYMBOL_DICTIONARY": {\n';
	json += '"Symbols": [\n';
	for (d = 0; d < dictionary.length; d++) {
		json += '{\n';
		json += parseSymbol(dictionary[d]);
		json += (d < dictionary.length - 1) ? '},\n' : '}\n';
	}
	json += ']\n';
	json += '},\n';
	
	// Add Metadata
	json += '"metadata": {\n';
	json += '"framerate": ' + doc.frameRate + "\n";
	json += '}\n';
	
	json += "}";
	return json;
}

function findDictionary(symbol, dictionary)
{	
	for (l = 0; l < symbol.timeline.layers.length; l++)
	{
		var layer = symbol.timeline.layers[l];
		for (f = 0; f < layer.frames.length; f++)
		{
			var frame = layer.frames[f];
			for (e = 0; e < frame.elements.length; e++)
			{
				var element = frame.elements[e];
				if (element.elementType == "instance")
				{
					var libraryItem = element.libraryItem;
					if (dictionary.indexOf(libraryItem) == -1) {
						dictionary.push(libraryItem);
						findDictionary(libraryItem, dictionary);
					}
				}
			}
		}
	}

	return dictionary;
}

function parseSymbol(symbol)
{
	var json = '';
	
	var timeline = symbol.timeline;
	
	json += jsonStr("SYMBOL_name", symbol.name);
	
	json += '"TIMELINE": {\n';
	json += '"LAYERS": [\n';
	
	// We only need the visible layers
	var layers = [];
	for (l = 0; l < timeline.layers.length; l++) {
		var layer = timeline.layers[l];
		if (layer.visible) {
			layers.push(layer);
		}
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
	smIndex++;
	
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
}

function parseSymbolInstance(instance)
{
	var json = '"SYMBOL_Instance": {\n';
	
	if (instance.libraryItem != undefined) {
		json += jsonStr("SYMBOL_name", instance.libraryItem.name);
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
			json += '\n{\n';
			json += jsonStr("name", filter.name);
			
			// TODO: implement the rest of the filters
			// Also im not sure switch statements are working??
			switch (filter.name) {
				case "blurFilter":
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
	var result = 3;
	switch (quality) {
		case "low": quality = 1;
		case "medium": quality = 2;
		case "high": quality = 3;
	}
	return result;
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
