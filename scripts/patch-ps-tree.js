const fs = require('node:fs');
const path = require('node:path');

const psTreeFile = path.join(__dirname, '..', 'node_modules', 'ps-tree', 'index.js');

if (fs.existsSync(psTreeFile)) {
	let content = fs.readFileSync(psTreeFile, 'utf8');
	if (content.includes("spawn('wmic.exe'")) {
		const target = "    processLister = spawn('wmic.exe', ['PROCESS', 'GET', 'Name,ProcessId,ParentProcessId,Status']);\n  } else {\n    processLister = spawn('ps', ['-A', '-o', 'ppid,pid,stat,comm']);\n  }";
		const replacement = "    var psScript = \"$ProgressPreference = 'SilentlyContinue'; Write-Output 'Name  ParentProcessId  ProcessId  Status'; Get-CimInstance Win32_Process | ForEach-Object { Write-Output (\\\"{0}  {1}  {2}  OK\\\" -f ($_.Name -replace ' ','_'), $_.ParentProcessId, $_.ProcessId) }\";\n    var b64 = Buffer.from(psScript, 'utf16le').toString('base64');\n    processLister = spawn('powershell.exe', ['-NoProfile', '-EncodedCommand', b64]);\n  } else {\n    processLister = spawn('ps', ['-A', '-o', 'ppid,pid,stat,comm']);\n  }\n  processLister.on('error', callback);";
		
		if (content.includes(target)) {
			content = content.replace(target, replacement);
			fs.writeFileSync(psTreeFile, content, 'utf8');
			console.log('[patch-ps-tree] Successfully patched ps-tree for Windows 11 compatibility.');
		}
	}
}
