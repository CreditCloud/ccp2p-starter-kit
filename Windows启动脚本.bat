@echo off
@echo �������� 4000 �˿�������̬�ļ���������Windows ����ǽ���ܻ���ʾ�Ƿ�����������ʣ�����ѡ���ھ������ڹ����Ա�ʹ���������������������������ʵ��ԡ�
if /i "%processor_architecture%"=="AMD64" GOTO AMD64
if /i "%PROCESSOR_ARCHITEW6432%"=="AMD64" GOTO AMD64
if /i "%processor_architecture%"=="x86" GOTO x86
GOTO ERR
:AMD64
    node64.exe server.js
:x86
    node.exe server.js
@echo �����ˣ������� 4000 �˿��ѱ�ռ�ã�EADDRINUSE ���󣩣�
pause
GOTO END
:ERR
@echo ��֧�ֵ�CPU�ܹ���"%processor_architecture%"!
pause
:END