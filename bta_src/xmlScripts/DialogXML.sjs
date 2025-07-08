var included = {};
include = function(file) {
	if (included[file]) { return; }
		included[file] = true;
	eval(FLfile.read(fl.configURI+"Commands/bta_src/"+file+".sjs"));
}


include("SaveData");

var save = [];

if (FLfile.exists(fl.configURI + "Commands/bta_src/saveBTA.txt"))
    save = FLfile.read(fl.configURI + "Commands/bta_src/saveBTA.txt").split("\n");

function myThing()
{
    //fl.trace(fl.xmlui.get("imgDims"));
    var isVisible = fl.xmlui.getVisible("DFormat"); 
    //fl.trace(isVisible);
    
    //fl.trace(fl.xmlui.get("algorithm"));
    fl.xmlui.set("algorithm", "MaxRects");


    //fl.trace(save);
}

function addParams()
{

    var config = fl.configURI;

	var rawXML = fl.runScript(fl.configURI + "Commands/bta_src/save.sjs", "xmlAddData");

	var xPan = SaveData.openXMLFromString(rawXML);

    var save = [];

    save[0] = xPan.INSYM;
    save[1] = xPan.BATX;
    save[2] = xPan.INCS;
    save[3] = xPan.BOFS;
    save[4] = xPan.BF;
    save[5] = xPan.BTW;
    save[6] = xPan.INCAS;
    save[7] = xPan.ORECTS;

    FLfile.write(fl.configURI + "Commands/bta_src/saveADDBTA.txt", save.join("\n"));
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
	var actP = path.charAt(0) + ":";
	path = path.substring(2);
	
	actP += path;

    actP = actP.split("%20").join(" ");
    actP = actP.split("%27").join("'");

	return actP;
}

fl.runScript(fl.configURI + "Commands/bta_src/save.sjs", "theme");

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

    var data = FLfile.read(fl.configURI + 'Commands/bta_src/BTAConfirm.xml');

	data = data.split("$CONFIGDIR").join(fl.configDirectory);
    data = data.split("$EXPATH").join(saveBox);
    
    var check = SaveData.openXMLFromString(data);

    if (check.dismiss == "accept")
        saveAndClose();
}

function saveAndClose()
{

    var save = [];
    var saveArray = fl.xmlui.get("saveBox").split("/").join("\\").split("\\");
    saveArray.pop();
    var savePath = saveArray.join("\\");
    save[0] = savePath;
    save[1] = fl.xmlui.get("ShpPad");
    save[2] = fl.xmlui.get("BrdPad");
    save[3] = fl.xmlui.get("ResSld");
    save[4] = fl.xmlui.get("OptDimens");
    save[5] = fl.xmlui.get("OptAn");
    save[6] = fl.xmlui.get("FlatSke");
    save[7] = fl.xmlui.get("algorithm");
    save[8] = fl.xmlui.get("imgFormat");
    save[9] = fl.xmlui.get("Rotate");

    //fl.trace(save.join("\n"));
    //fl.trace(fl.configURI + "Commands/bta_src/saveBTA.txt");

    FLfile.write(fl.configURI + "Commands/bta_src/saveBTA.txt", save.join("\n"));
    fl.xmlui.accept();
}
