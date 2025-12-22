var version = fl.version.split(" ")[1].split(",");

function xmlData(symbols)
{
    var data = FLfile.read(fl.configURI + "Commands/bta_src/BTADialog.xml");
    var saveData = FLfile.read(fl.configURI + "Commands/bta_src/saveBTA.txt").split("\n");

	var symbols = String(symbols).split('_bta_');
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

	data = data.split("$CONFIGDIR").join(fl.configDirectory);
	data = data.split("$FILEURI").join(fileuri);
	data = data.split("$SHP").join(saveData[1]);
	data = data.split("$BRD").join(saveData[2]);
	data = data.split("$RES").join(saveData[3]);
	data = data.split("$OPTDIM").join(saveData[4]);
	data = data.split("$OPTAN").join(saveData[5]);
	data = data.split("$FLAT").join(saveData[6]);
	data = data.split("$ROT").join(saveData[9]);

	var buttonWidth = 0;
	if (parseInt(version[0]) >= 20)
		buttonWidth = 45;

	data = data.split("$BWI").join(buttonWidth);

    return data;
}


function xmlAddData()
{
    var data = FLfile.read(fl.configURI + "Commands/bta_src/BTAAdd.xml");
    var saveData = FLfile.read(fl.configURI + "Commands/bta_src/saveADDBTA.txt").split("\n");

	data = data.split("$INSYM").join(saveData[0]);
	data = data.split("$BATX").join(saveData[1]);
	data = data.split("$INCS").join(saveData[2]);
	data = data.split("$BOFS").join(saveData[3]);
	data = data.split("$BF").join(saveData[4]);
	data = data.split("$BTW").join(saveData[5]);
	data = data.split("$INCAS").join(saveData[6]);
	//data = data.split("$ORECTS").join(saveData[7]);

	var buttonWidth = 0;
	if (parseInt(version[0]) >= 20)
		buttonWidth = 50;

	data = data.split("$BWI").join(buttonWidth);

    return data;
}

function xmlSaveStuff()
{
    var config = fl.configURI;

	var rawXML = xmlAddData();

	var xPan = null;

	// Flash doesnt support direct panels from strings so we gotta create a temp xml
	if (parseInt(version[0]) < 15 && parseInt(version[1]) < 1)
	{
		var tempP = config + "Commands/bta_src/_BTAD.xml";
		FLfile.write(tempP, rawXML, null);
		xPan = fl.xmlPanel(tempP);
		FLfile.remove(tempP);
	}
	else
	{
		xPan = fl.xmlPanelFromString(rawXML);
	}

    var save = [];

    save[0] = xPan.INSYM;
    save[1] = xPan.BATX;
    save[2] = xPan.INCS;
    save[3] = xPan.BOFS;
	save[4] = xPan.BF;
	save[5] = xPan.BTW;
	save[6] = xPan.INCAS;
	//save[7] = xPan.ORECTS;

    FLfile.write(fl.configURI + "Commands/bta_src/saveADDBTA.txt", save.join("\n"));
}

function theme()
{
    var stuff = "";
    var leVersion = parseInt(version[0]);
	if (leVersion >= 13)
    {
        if (leVersion < 20)
            stuff = fl.getThemeColor("themeAppBackgroundColor");
        else
        {
            stuff = fl.getThemeColor("themeAppBackgroundColor");
            switch(stuff)
            {
                    case "#404040": stuff = (leVersion >= 24) ? "#323232" : "#333333"; break;
                    case "#262626": stuff = (leVersion >= 24) ? "#1D1D1D" : "#1f1f1f"; break;
                    case "#B9B9B9": stuff = (leVersion >= 24) ? "#F8F8F8" : "#f5f5f5"; break;
                    case "#F2F2F2": stuff = "#ffffff"; break;
            }
        }
    }
    else {
        stuff = "#f0f0f0";
    }

    FLfile.write(fl.configURI + "Commands/bta_src/BTATheme.txt", stuff);
}