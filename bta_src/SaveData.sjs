SaveData = function() {}

SaveData.platform = fl.version.split(" ")[0];
SaveData.version = fl.version.split(" ")[1].split(",");

SaveData.setupSaves = function() 
{
    if (!FLfile.exists(fl.configURI + "Commands/bta_src/saveBTA.txt"))
	{
		var saveConfig = [
			"", // pos
			0, // ShpPad
			0, // BrdPad
			1, // res
			true, // optDimens
			true, // optAn
			false // flatten
		];

		FLfile.write(fl.configURI + "Commands/bta_src/saveBTA.txt", saveConfig.join("\n"));
	}
	if (!FLfile.exists(fl.configURI + "Commands/bta_src/saveADDBTA.txt"))
	{
		var save = [];

		save[0] = inlineSym;
		save[1] = bakeTexts;
		save[2] = includeSnd;
		save[3] = bakeOneFR;

		FLfile.write(fl.configURI + "Commands/bta_src/saveADDBTA.txt", save.join("\n"));
	}
}


SaveData.openXMLFromString = function(rawXML)
{
	
	// Flash doesnt support direct panels from strings so we gotta create a temp xml
	var xPan = null;
	if (parseInt(version[0]) < 15 && parseInt(version[1]) < 1)
	{
		var count = 1;
		
		var tempP = fl.configURI + "Commands/bta_src/_BTAD(" + count + ").xml";

		while (FLfile.exists(tempP))
		{
			count += 1;
			tempP = fl.configURI + "Commands/bta_src/_BTAD(" + count + ").xml";
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