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
	json += parseSymbol(symbol);
	json += '},\n';
	
	// Add Symbol Dictionary
	json += '"SYMBOL_DICTIONARY": {\n';
	json += '"Symbols": [\n';
	json += ']\n';
	json += '},\n';
	
	// Add Metadata
	json += '"metadata": {\n';
	json += '"framerate": ' + doc.frameRate + "\n";
	json += '}\n';
	
	json += "}";
	return json;
}

function parseSymbol(symbol)
{
	var json = '';
	
	var timeline = symbol.timeline;
	var layers = timeline.layers;
	
	json += '"SYMBOL_name": "' + symbol.name + '",\n';
	
	json += '"TIMELINE": {\n';
	json += '"LAYERS": [\n';
	
	// Add Layers and Frames
	for (l = 0; l < layers.length; l++)
	{
		var layer = layers[l];		
		json += '{\n';
		json += '"Layer_name": "' + layer.name + '",\n';
		json += '"Frames": [\n';
		json += parseFrames(layer.frames);
		json += ']\n';
		json += (l < layers.length - 1) ? '},\n' : '}\n';
	}
	
	json += ']\n';
	json += '}\n';
	
	return json;
}

function parseFrames(frames)
{
	var json = '';
	
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
		json += '"index": ' + frame.startFrame + ',\n';
		json += '"duration": ' + frame.duration + ',\n';
		json += '"elements": [\n';
		// TODO: parse elements
		json += ']\n';
		json += (f < startFrames.length - 1) ? '},\n' : '}\n';
	}
	
	return json;
}

function findSymbol(name) {
	var index = lib.findItemIndex(symbol);
	if (index !== -1) {
		return lib.items[index];
	}

	fl.trace("Symbol not found: " + name);
	return null;
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