///// CONFIGURATION

var path = "Users/marut/OneDrive/Documentos/GitHub/BetterTextureAtlas/testing"
var symbol = "Boyfriend DJ";

/////

var configDir = fl.configDirectory;
var doc = fl.getDocumentDOM();
var lib = doc.library;

exportAtlas(path, symbol);

function exportAtlas(exportPath, symbolName)
{
	var exporter = setupExporter(exportPath);
	var symbol = findSymbol(symbolName);
	
	if (!(symbol.itemType == "graphic" || symbol.itemType == "movie clip")) {
		fl.trace("Invalid symbol type: " + symbol.itemType);
		return;
	}
	
	// Export the basic data
	exporter.exportTextureAtlas(symbol);

	// Generate custom json	
	var jsonResult = generateJson(symbol);

	// Override Animation.json with custom format
	FLfile.write(formatPath(path + "/Animation.json"), jsonResult);
	
	fl.trace("Exported to folder: " + exportPath);
}

function generateJson(symbol) {
	var json ="{\n";
	
	// Add Animation
	json += '"ANIMATION": {\n';
	//json += '"StageInstance": {\n';
	//json += parseSymbolInstance(symbol);
	//json += '},\n';
	json += parseSymbol(symbol);
	json += '},\n';
	
	var dictionary = findDictionary(symbol);
	
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

function findDictionary(symbol)
{
	var dictionary = [];
	
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
	var layers = timeline.layers;
	
	json += jsonStr("SYMBOL_name", symbol.name);
	
	json += '"TIMELINE": {\n';
	json += '"LAYERS": [\n';
	
	// Add Layers and Frames
	for (l = 0; l < layers.length; l++)
	{
		var layer = layers[l];		
		json += '{\n';
		json += jsonStr("Layer_name", layer.name);
		json += parseFrames(layer.frames);
		json += (l < layers.length - 1) ? '},\n' : '}\n';
	}
	
	json += ']\n';
	json += '}\n';
	
	return json;
}

function parseFrames(frames)
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
		json += parseElements(frame.elements);
		json += (f < startFrames.length - 1) ? '},\n' : '}\n';
	}
	
	json += ']\n';
	return json;
}

function parseElements(elements)
{
	var json = '"elements": [\n';
	
	for (e = 0; e < elements.length; e++)
	{
		var element = elements[e];
		switch (element.elementType) {
			case "shape":
			case "text":
			case "tlfText":
			case "instance":
				json += parseSymbolInstance(element);
			case "shapeObj":
		}
	
		if (e < elements.length -1) {
			json += ",";
		}
	}
	
	json += ']\n';
	return json;
}

// TODO: atlas instance crap

function parseAtlasIntance(instance)
{
	
}

function parseSymbolInstance(instance)
{
	var json = "{\n";
	json += '"SYMBOL_Instance": {\n';
	
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
	json += '"filters": [\n';
	
	var filters = instance.filters;
	if (filters != undefined) {
		for (i = 0; i < filters.length; i++) {
			var filter = filters[i];
			json += '{\n';
			json += jsonStr("name", filter.name);
			
			// TODO: implement the rest of the filters
			switch (filter.name) {
				case "blurFilter":
				json += jsonVar("blurX", filter.blurX);
				json += jsonVar("blurY", filter.blurY);
				json += '"quality": ' + parseQuality(filter.quality) + '\n';
			}
			
			json += (i < filters.length - 1) ? '},\n' : '}\n';
		}
	}
	
	json += ']\n';
	
	json += '}\n}\n';
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

function setupExporter(path) {
	var exporter = new TextureAtlasExporter;

	exporter.filePath = formatPath(path);
	exporter.algorithm = "maxRects";
	exporter.autoSize = true;
	exporter.resolution = 1;
	exporter.optimizeJson = false;
	exporter.imageFormat = "RGB8888";
	exporter.optimizeBitmap = true;
	
	return exporter;
}

function formatPath(path) {
	return "file:///C|/" + path;
}