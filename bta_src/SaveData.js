SaveData = function() {}

SaveData.platform = fl.version.split(" ")[0];
SaveData.version = fl.version.split(" ")[1].split(",");

SaveData.setupSaves = function(scriptFolder) 
{
    if (!FLfile.exists(scriptFolder+"/bta_src/saveBTA.txt"))
	{
		var saveConfig = [
			"", // pos
			3, // shape pad
			3, // border pad
			1, // resolution
			true, // optimize dimensions
			true, // optimize animation
			false, // flatten skew
			"MaxRects", // algorithm
			"PNG 32 bits", // image format
			true // rotate
		];

		FLfile.write(scriptFolder+"/bta_src/saveBTA.txt", saveConfig.join("\n"));
	}
	if (!FLfile.exists(scriptFolder+"/bta_src/saveADDBTA.txt"))
	{
		var save = [];

		save[0] = true;//inlineSym;
		save[1] = true;//bakeTexts;
		save[2] = false;//includeSnd;
		save[3] = true;//bakeOneFR;
		save[4] = false;//bakedFilters;
		save[5] = true;//bakedTweens;
		save[6] = false;//includeAs;

		FLfile.write(scriptFolder+"/bta_src/saveADDBTA.txt", save.join("\n"));
	}
}

SaveData.openXMLFromString = function(rawXML, scriptFolder)
{
	// Flash doesnt support direct panels from strings so we gotta create a temp xml
	var xPan = null;
	if (parseInt(SaveData.version[0]) < 15 && parseInt(SaveData.version[1]) < 1)
	{
		var count = 1;
		
		var tempP = scriptFolder+"/bta_src/_BTAD(" + count + ").xml";

		while (FLfile.exists(tempP))
		{
			count += 1;
			tempP = scriptFolder+"/bta_src/_BTAD(" + count + ").xml";
		}

		FLfile.write(tempP, rawXML, null);
		xPan = fl.xmlPanel(tempP);
		FLfile.remove(tempP);
	}
	else
	{
		xPan = fl.xmlPanelFromString(rawXML);
	}

	return xPan;
}

SaveData.xmlData = function (symbols, scriptFolder)
{
    var data = FLfile.read(scriptFolder+"/bta_src/BTADialog.xml").split("$SCRIPTFOLDER").join('"'+scriptFolder+'"');
    var saveData = FLfile.read(scriptFolder+"/bta_src/saveBTA.txt").split("\n");

	var symbols = symbols.split('_bta_');
	var symbolID = symbols[0];

	if (symbols.length > 1) // use the document name if its a packed symbol
	{
		var accName = fl.getDocumentDOM().name.split("."); accName.pop();
		symbolID = accName.join(".")
	}
	
	var formatSymbolName = String(symbolID).split("/").pop().split(",").pop();
	var fileuri = saveData[0];
	
	if (fileuri.length <= 0) {
		var document = fl.getDocumentDOM();
		var docPath = document.path.split("\\");
		docPath.pop();
		fileuri = docPath.join("\\");
	}

	fileuri += "\\" + formatSymbolName;
	
	// xml formatting of special characters (fix fucked display in older flash xml dialog)
	fileuri = fileuri
	.replace(/&/g, '&amp;')
	.replace(/"/g, '&quot;')
	.replace(/'/g, '&apos;')
	.replace(/</g, '&lt;')
	.replace(/>/g, '&gt;');

	data = data.split("$CONFIGDIR").join(FLfile.uriToPlatformPath(scriptFolder));
	data = data.split("$FILEURI").join(fileuri);
	data = data.split("$SHP").join(saveData[1]);
	data = data.split("$BRD").join(saveData[2]);
	data = data.split("$RES").join(saveData[3]);
	data = data.split("$OPTDIM").join(saveData[4]);
	data = data.split("$OPTAN").join(saveData[5]);
	data = data.split("$FLAT").join(saveData[6]);
	data = data.split("$ROT").join(saveData[9]);

	var buttonWidth = 0;
	if (parseInt(SaveData.version[0]) >= 20)
		buttonWidth = 45;

	data = data.split("$BWI").join(buttonWidth);

    return data;
}

SaveData.xmlAddData = function (scriptFolder)
{
    var data = FLfile.read(scriptFolder+"/bta_src/BTAAdd.xml");
    var saveData = FLfile.read(scriptFolder+"/bta_src/saveADDBTA.txt").split("\n");

	data = data.split("$INSYM").join(saveData[0]);
	data = data.split("$BATX").join(saveData[1]);
	data = data.split("$INCS").join(saveData[2]);
	data = data.split("$BOFS").join(saveData[3]);
	data = data.split("$BF").join(saveData[4]);
	data = data.split("$BTW").join(saveData[5]);
	data = data.split("$INCAS").join(saveData[6]);
	//data = data.split("$ORECTS").join(saveData[7]);

	var buttonWidth = 0;
	if (parseInt(SaveData.version[0]) >= 20)
		buttonWidth = 50;

	data = data.split("$BWI").join(buttonWidth);

    return data;
}

SaveData.theme = function (scriptFolder)
{
    var stuff = "";
    var version = parseInt(SaveData.version[0]);
	if (version >= 13)
    {
        if (version < 20)
            stuff = fl.getThemeColor("themeAppBackgroundColor");
        else
        {
            stuff = fl.getThemeColor("themeAppBackgroundColor");
            switch(stuff)
            {
                    case "#404040": stuff = (version >= 24) ? "#323232" : "#333333"; break;
                    case "#262626": stuff = (version >= 24) ? "#1D1D1D" : "#1f1f1f"; break;
                    case "#B9B9B9": stuff = (version >= 24) ? "#F8F8F8" : "#f5f5f5"; break;
                    case "#F2F2F2": stuff = "#ffffff"; break;
            }
        }
    }
    else {
        stuff = "#f0f0f0";
    }

    FLfile.write(scriptFolder+"/bta_src/BTATheme.txt", stuff);
}

SaveData.saveAndCloseXML = function (scriptFolder)
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
    //fl.trace(scriptFolder+"/bta_src/saveBTA.txt");

    FLfile.write(scriptFolder+"/bta_src/saveBTA.txt", save.join("\n"));
    fl.xmlui.accept();
}
