Option Explicit

Dim shell, fso, root, launcher, cmd, checkCmd, status
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
root = fso.GetParentFolderName(WScript.ScriptFullName)
launcher = fso.BuildPath(root, "launcher.py")

If Not fso.FileExists(launcher) Then
  MsgBox "launcher.py nao foi encontrado na pasta do VARISPEED.", vbCritical, "VARISPEED"
  WScript.Quit 1
End If

' Valida o runtime sem exibir console. Isso evita falha silenciosa quando o
' Python Install Manager existe, mas nenhum Python 3 compativel esta instalado.
checkCmd = "py -3 -c ""import sys; raise SystemExit(0 if sys.version_info >= (3,11) else 1)"""
On Error Resume Next
status = shell.Run(checkCmd, 0, True)
If Err.Number <> 0 Or status <> 0 Then
  Err.Clear
  MsgBox "Python 3.11 ou superior nao foi encontrado." & vbCrLf & vbCrLf & _
         "No Prompt de Comando, use por exemplo:" & vbCrLf & _
         "py install 3.13" & vbCrLf & _
         "py -3.13 --version", vbCritical, "VARISPEED"
  WScript.Quit 1
End If
Err.Clear

' Executa o launcher com a janela do console oculta.
cmd = "py -3 """ & launcher & """"
shell.Run cmd, 0, False
If Err.Number <> 0 Then
  Err.Clear
  MsgBox "Nao foi possivel iniciar o launcher do VARISPEED.", vbCritical, "VARISPEED"
  WScript.Quit 1
End If
On Error GoTo 0
