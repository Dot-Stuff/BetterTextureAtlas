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
	
	exporter.exportTextureAtlas(symbol);
	fl.trace("Exported to folder: " + exportPath);
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

	exporter.filePath = "file:///C|/" + path;
	exporter.algorithm = "maxRects";
	exporter.autoSize = true;
	exporter.resolution = 1;
	exporter.optimizeJson = false;
	exporter.imageFormat = "RGB8888";
	exporter.optimizeBitmap = true;
	
	return exporter;
}