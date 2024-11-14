const fs = require('fs');
const readline = require('readline');

const fileStream = fs.createReadStream(process.argv[2]);

const rl = readline.createInterface({
  input: fileStream,
  crlfDelay: Infinity
});

var read_status = 0; //0=未读取到消息正文 1=准备读取消息分组 2=准备读取消息对象 3=正在读取消息正文
var newFileStream;
var currentListName;
var currentTargetName;
var currentHeadInfo;

rl.on('line', (line) => {
	if(line == "================================================================")
	{
		currentHeadInfo += line + '\n';
		switch(read_status)
		{
			case 2:
			{
				fs.mkdir(currentListName, { recursive: true }, (err) => {
					if (err)
					{
						console.error('创建目录时出错:', err);
						return;
					}
				});
				read_status = 3;
				newFileStream = fs.createWriteStream(`./${currentListName}/${currentTargetName.replace(/[\\/:*?"<>|]/g, '_')}.txt`);
				newFileStream.write(currentHeadInfo);
				currentHeadInfo = '';
				break;
			}
			case 3:
			{
				if(newFileStream) newFileStream.end();
				read_status = 1;
				break;
			}
			default:
			{
				read_status += 1;
				break;
			}
		}
	}
	else switch(read_status)
	{
		case 1:
		{
			currentListName = line.match(/(?<=消息分组:).+/)[0];
			currentHeadInfo += line + '\n';
			break;
		}
		case 2:
		{
			currentTargetName = line.match(/(?<=消息对象:).+/)[0];
			console.log(currentListName + ' > ' + currentTargetName);
			currentHeadInfo += line + '\n';
			break;
		}
		case 3:
		{
			newFileStream.write(line + '\n');
			break;
		}
	}
});

// 文件读取完毕
rl.on('close', () => {
  console.log('>> 分割完毕。');
});
