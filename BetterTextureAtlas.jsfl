///// CONFIGURATION

var path = "Users/marut/OneDrive/Documentos/GitHub/BetterTextureAtlas/testing"
var symbol = "Boyfriend DJ";
var meshExport = false; // If to use a spritemap or mesh vertex data

/////

var configDir = fl.configDirectory;
var doc = fl.getDocumentDOM();
var lib = doc.library;

exportAtlas(path, symbol);

//var spritemap = {};
var smIndex = 0;

function exportAtlas(exportPath, symbolName)
{
	//var exporter = setupExporter(exportPath);
	var symbol = findSymbol(symbolName);
	//spritemap = {};
	smIndex = 0;
	
	if (!(symbol.itemType == "graphic" || symbol.itemType == "movie clip")) {
		fl.trace("Invalid symbol type: " + symbol.itemType);
		return;
	}
	
	// Export the basic data
	//exporter.exportTextureAtlas(symbol);

	// Write Animation.json
	var animJson = generateAnimation(symbol);
	FLfile.write(formatPath(path + "/Animation.json"), animJson);

	// Generate Spritemap
	var sm = new SpriteSheetExporter;
	sm.algorithm = "maxRects";
	sm.borderPadding = 3;
	sm.autoSize = true;
	sm.allowRotate = true;
	sm.allowTrimming = true;

	// OK this becomes SUPER bullshit but you gotta do what you gotta do
	
	/*
	for (i = 0; i < smIndex; i++)
	{
		var shape = spritemap[i];
		
		lib.deleteItem("_ta_temp_");
		lib.addNewItem("movie clip", "_ta_temp_" );
		dom.enterEditMode( "inPlace" );
		
		//shape.selected = true;
		//doc.enterEditMode( "inPlace" );
		
		//shape.selected = false;
		
		/*shape.selected = true;
		
		lib.deleteItem("_ta_temp_");
		lib.addNewItem("movie clip", "_ta_temp_");
		
		var index = lib.findItemIndex("_ta_temp_");
		var item = lib.items[index];*/
		
		//doc.clipCopy();
		//lib.editItem("_ta_temp_");
		//doc.clipPaste();
		
		//var frame = item.timeline.layers[0].frames[0];
		//frame.elements.unshift(shape);
		//frame.elements.push(shape);
		
		//shape.selected = false;
		
		
		//fl.trace(frame.elements.length);
		
		//var symbol = new SymbolItem;
		//symbol.timeline = new Timeline;
		//symbol.timeline;//.insertKeyframe()
		
		//fl.trace(symbol.timeline);
			
		//shape.selected = true;
		//dummyDoc.addItem({x:0,y:0}, shape);
		
		//var symbol = dummyDoc.convertToSymbol("graphic", "mcSymbolName", "center");
		//fl.trace(symbol);
		
		//shape.selected = false;
		
		//doc.selectNone();
		//shape.selected = true;
		
		//var symbol = doc.convertToSymbol("graphic", "mcSymbolName", "center");
		//fl.trace(doc.selection);
		//doc.convertToSymbol("graphic", "mcSymbolName", "center"); 
		
		//var selection = new Array();
		//selection[0] = shape;
		//doc.selection = selection;
		// fl.getDocumentDOM().selection = selection;
		
		//fl.trace(doc.selection.length);
		
		//var symbol = doc.convertToSymbol("movie clip", "fuck", "top left");
		//fl.trace(symbol);
		
		//var symbol = //...convert shape to symbol instance
		
		//shape.selected = false;
	//}

	//lib.deleteItem("_ta_temp_");
	
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
		json += parseFrames(layer.frames, symbol);
		json += (l < layers.length - 1) ? '},\n' : '}\n';
	}
	
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
			
		json += '{\n';
		json += jsonVar("index", frame.startFrame);
		json += jsonVar("duration", frame.duration);
		json += parseElements(frame.elements, symbol);
		json += (f < startFrames.length - 1) ? '},\n' : '}\n';
	}
	
	json += ']\n';
	return json;
}

function parseElements(elements, symbol)
{
	var json = '"elements": [\n';
	
	for (e = 0; e < elements.length; e++)
	{
		var element = elements[e];
		var type = element.elementType;
		
		json += "{\n";
		
		if (type == "shape") {
			json += parseShape(element, symbol);
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

function parseShape(shape, symbol)
{
	var json = '"ATLAS_SPRITE_instance": {\n';

	json += jsonVar("Matrix", parseMatrix(shape.matrix));

	json += '"name": "' + smIndex + '"\n';
	
	// TODO: do this diferently if its mesh mode
	shapeToSymbol(shape, symbol);
	smIndex++;
	
	//fl.trace(symbol.name);
	
	json += '}\n';
	return json;
}

function shapeToSymbol(shape, parentSymbol) {
	lib.editItem(parentSymbol.name);
	doc.selectNone();
	
	shape.selected = true;
	doc.clipCopy();

	//if (lib.itemExists("_temp_atlas_")) {
	//	lib.deleteItem("_temp_atlas_");
	//}
	
	//var symbol = doc.convertToSymbol("movie clip", "_temp_atlas_", "top left");
	
	
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

/*
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
}*/

function formatPath(path) {
	return "file:///C|/" + path;
}