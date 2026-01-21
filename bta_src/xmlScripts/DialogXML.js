var scriptFolder = "$FOLDERINPUT";

var included = {};
include = function(file) {
	if (included[file]) { return; }
		included[file] = true;
	eval(FLfile.read(scriptFolder+"/bta_src/"+file+".js"));
}

include("SaveData");

var save = [];

if (FLfile.exists(scriptFolder+"/bta_src/saveBTA.txt"))
    save = FLfile.read(scriptFolder+"/bta_src/saveBTA.txt").split("\n");

function addParams()
{
    //var config = fl.configURI;
    //var rawXML = fl.runScript(scriptFolder+"/bta_src/save.js", "xmlAddData", scriptFolder);

    var rawXML = SaveData.xmlAddData(scriptFolder);
    var xPan = SaveData.openXMLFromString(rawXML, scriptFolder);

    var save = [];

    save[0] = xPan.INSYM;
    save[1] = xPan.BATX;
    save[2] = xPan.INCS;
    save[3] = xPan.BOFS;
    save[4] = xPan.BF;
    save[5] = xPan.BTW;
    save[6] = xPan.INCAS;
    save[7] = xPan.ORECTS;

    FLfile.write(scriptFolder+"/bta_src/saveADDBTA.txt", save.join("\n"));
}

function algorithmSet()
{
    var value = "MaxRects";

    if (save[7] != null)
        value = save[7];

    fl.xmlui.set("algorithm", value);

    algorithmSel();
}

function getPath()
{
    var uri = null;
    if (SaveData.version[0] > 12)
        uri = fl.browseForFileURL("save", "Select destiny path", "(*.)", "");
    else
    {
        uri = fl.browseForFileURL("save", "Select destiny path", {}, "|TEXT[*.||", "|*.||");
    }

    if (uri != null)
    {
        fl.xmlui.set("saveBox", formatPath(uri.substring(0, uri.length - 2)))
    }
}

function formatPath(path)
{
	// All good here im gonna assume
	if (path.split("file:///").length < 1) {
		return path;
	}

	path = path.substring(8);

    // If we're on macOS, we skip the path formatting nonsense.
    if (fl.version.substring(0, 3) == "MAC") {
        path = path.split("%20").join(" ");
        path = path.split("%27").join("'");
        path = path.split("%5C").join("/");

        return path;
    }

	var actP = path.charAt(0) + ":";
	path = path.substring(2);
	
	actP += path;

    actP = actP.split("%20").join(" ");
    actP = actP.split("%27").join("'");

	return actP;
}

//fl.runScript(scriptFolder+"/bta_src/save.js", "theme", scriptFolder);

SaveData.theme(scriptFolder);

function imgFormatSet()
{
    var value = "PNG 32 bits";

    if (save[8] != null)
        value = save[8];

    fl.xmlui.set("imgFormat", value);
}

function algorithmSel()
{
    var value = fl.xmlui.get("algorithm");

    fl.xmlui.setEnabled("Rotate", value == "MaxRects");
}

function dFormatSel()
{
    var value = fl.xmlui.get("DFormat");

    
    fl.xmlui.setEnabled("Rotate", value == "raster");
    fl.xmlui.setEnabled("imgFormat", value == "raster");
    fl.xmlui.setEnabled("imgDims", value == "raster");
    fl.xmlui.setEnabled("ResSld", value == "raster");
    fl.xmlui.setEnabled("ShpPad", value == "raster");
    fl.xmlui.setEnabled("BrdPad", value == "raster");
    fl.xmlui.setEnabled("OptDimens", value == "raster");
    fl.xmlui.setEnabled("FlatSke", value == "raster");
    fl.xmlui.setEnabled("algorithm", value == "raster");
    fl.xmlui.setEnabled("cusWid", value == "raster");
    fl.xmlui.setEnabled("cusHei", value == "raster");
}

function accept()
{
    var saveBox = fl.xmlui.get("saveBox");

    if (!FLfile.exists(FLfile.platformPathToURI(saveBox)))
    {
        saveAndClose();
        return;
    }

    var data = FLfile.read(scriptFolder+"/bta_src/BTAConfirm.xml");
	data = data.split("$CONFIGDIR").join(FLfile.uriToPlatformPath(scriptFolder));
    data = data.split("$EXPATH").join(saveBox);
    
    var check = SaveData.openXMLFromString(data, scriptFolder);
    if (check.dismiss == "accept")
        SaveData.saveAndCloseXML(scriptFolder)
}