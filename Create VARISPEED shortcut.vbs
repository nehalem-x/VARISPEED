Option Explicit

Dim shell, fso, root, desktop, linkPath, link, target, iconPath
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

root = fso.GetParentFolderName(WScript.ScriptFullName)
desktop = shell.SpecialFolders("Desktop")
linkPath = fso.BuildPath(desktop, "VARISPEED.lnk")
target = fso.BuildPath(root, "VARISPEED.vbs")
iconPath = fso.BuildPath(root, "assets\varispeed.ico")

If Not fso.FileExists(target) Then
  MsgBox "VARISPEED.vbs nao foi encontrado.", vbCritical, "VARISPEED"
  WScript.Quit 1
End If

Set link = shell.CreateShortcut(linkPath)
link.TargetPath = shell.ExpandEnvironmentStrings("%SystemRoot%\System32\wscript.exe")
link.Arguments = """" & target & """"
link.WorkingDirectory = root
If fso.FileExists(iconPath) Then link.IconLocation = iconPath & ",0"
link.Description = "Iniciar VARISPEED"
link.WindowStyle = 1
link.Save

MsgBox "Atalho VARISPEED criado na Area de Trabalho.", vbInformation, "VARISPEED"
