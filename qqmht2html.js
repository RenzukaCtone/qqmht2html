"use strict";
const fs = require('fs');
const readline = require('readline');

var fileStream;
var outputFileName;
var outputImageFolder;
var lineLimitValue = 0;
var isSplit = false;
var totalSize = 0;
var curSize = 0;

var read_status = 0; //0=none 1=new part 2=读取 HTML 3=读取图像文件名 4=读取图像
//var skip_lines = 0; //跳过若干行
var html_line_count = 0; //已输出到文件的行数
var html_page_count = 0;
var newFileStream;
var htmlHead;
var currentListName;
var currentTargetName;
var currentImageType;
var currentImageName;
var bufferImage;
var processedImageCount = 0;

// from LLM
const args = process.argv.slice(2);
var currentOption = null;
// 解析 - 和 -- 参数
const options = {};
args.forEach((value, index) => {
  if (value.startsWith('-')) {
    currentOption = value.slice(1);
    if (value.startsWith('--')) {
      currentOption = value.slice(2);
    }
    if (args[index + 1] && !args[index + 1].startsWith('-')) {
      options[currentOption] = args[index + 1];
    } else {
      options[currentOption] = true;
    }
  } else if (currentOption !== null) {
    options[currentOption] = value;
    currentOption = null;
  }
});

if(options.h || options.help)
{
	console.log("用法:\tnode qqmht2html.js -i mhtfile [-hnops]\n");
	console.log("\t-h 显示此帮助");
	console.log("\t-i InputFileName\t输入 mht 文件。（必需）");
	console.log("\t-o Directory\t\t输出文件的目录，不指定则默认为当前目录。");
	console.log("\t-p ImageDirectoryName\t输出图像的目录名(该目录将位于 -o 指定的输出目录中)，不指定则默认为 img。");
	console.log("\t-n Number\t\t限制单个文件的最大消息数量。");
	console.log("\t-s --split\t\t按聊天对象对输出的 html 进行分割。此时 -n 依然有效。");
	console.log("例如:\tnode qqmht2html.js -i chat.mht -o output -p img -n 2000 -s");
	//console.log("-f 输出目录的前缀，也就是 Path Prefix。");
	return;
}
if(options.i) fileStream = fs.createReadStream(options.i); //mht file
else
{
	console.log("input atleast one mht file.");
	return;
}
totalSize = fs.statSync(options.i).size;
curSize = 0;

if(!options.o) options['o'] = '';
else if(!options.o.endsWith("/") && !options.o.endsWith("\\")) options.o += '/';
outputFileName = options.o + options.i.replace(/\..+$/, '') + ".html";
outputFileName = outputFileName.replace(/[\\/:*?"<>|]/g, '_');

if(options.p)
{
	if(!options.p.endsWith("/") && !options.p.endsWith("\\")) options.p += '/';
}
else options['p'] = 'img/';
outputImageFolder = options.o + options.p;

if(options.n) lineLimitValue = options.n;

if(options.s || options.split) isSplit = true;

/*
if(options.f)
{
	outputPathPrefix = options.f;
	if(!outputPathPrefix.endsWith("/") && !outputPathPrefix.endsWith("\\")) outputPathPrefix += '/';
}
else outputPathPrefix = '';
*/

const rl = readline.createInterface({
  input: fileStream,
  crlfDelay: Infinity
});

fs.mkdir(options.o, { recursive: true }, (err) => {
	if (err)
	{
		console.error('创建目录时出错:', err);
		return;
	}
});

fs.mkdir(outputImageFolder, { recursive: true }, (err) => {
	if (err)
	{
		console.error('创建目录时出错:', err);
		return;
	}
});

rl.on('line', (line) => {
	if(line == "") return;
	if(line.startsWith("------")) //------=_NextPart
	{
		switch(read_status)
		{
			case 2:
			{
				if(newFileStream) newFileStream.end();
				//html end
				console.log('图像输出目录: ' + outputImageFolder);
				break;
			}
			case 4:
			{
				if(newFileStream) newFileStream.end();
				newFileStream = fs.createWriteStream(outputImageFolder + "/" + currentImageName);
				newFileStream.write(Buffer.from(bufferImage, 'base64'));
				newFileStream.end();
				bufferImage = '';
				processedImageCount += 1;
				break;
			}
		}
		read_status = 1;
	}
	else switch(read_status)
	{
		case 1:
		{
			if(line.startsWith("Content-Type"))
			{
				if(line.endsWith("html"))
				{
					//html start
					console.log('HTML 输出目录: ' + options.o);
					read_status = 2;
					//skip_lines = 2;
					html_line_count = 0;
					if(!isSplit)
					{
						newFileStream = fs.createWriteStream(outputFileName);
						console.log(outputFileName);
					}
				}
				else
				{
					read_status = 3;
					currentImageType = line.slice(19);
				}
			}
			break;
		}
		case 2:
		{
		/*
			if(skip_lines > 0)
			{
				skip_lines -= 1;
				break;
			}
		*/
			if(!line.startsWith('<')) return;
			if(line.startsWith("<html"))
			{
				const indexNum = line.indexOf("<tr>");
				htmlHead = line.slice(0, indexNum);
				//line = line.slice(indexNum);
				//if(isSplit) htmlHead
			}
			//else if(line == "") read_status = 1;

			if(isSplit)
			{
				currentListName = line.match(/消息分组:(.+?)</);
				currentTargetName = line.match(/消息对象:(.+?)</);
				if(currentListName && currentTargetName)
				{
					if(newFileStream)
					{
						newFileStream.write("</table></body></html>\n");
						newFileStream.end();
					}
					html_line_count = 0;
					html_page_count = 0;
					outputFileName = options.o + decodeHtmlEntities(currentListName[1] + '_' + currentTargetName[1] + '.html').replace(/[\\/:*?"<>|]/g, '_');
					newFileStream = fs.createWriteStream(outputFileName);
					newFileStream.write(htmlHead + '\n');
					
					console.log(outputFileName);
				}
			}

			const newLine = line.replace(/(<IMG src=")(.*?)(">)/g, "$1" + options.p + "$2$3");
			newFileStream.write(newLine + '\n');
			html_line_count += 1;

			if(html_line_count >= lineLimitValue && lineLimitValue != 0)
			{
				if(newFileStream)
				{
					newFileStream.write("</table></body></html>\n");
					newFileStream.end();
					html_page_count += 1;
					
					var newOutputFileName;
					if(outputFileName.match(/\..+$/)) newOutputFileName = outputFileName.replace(/(\..+$)/, "_" + html_page_count + "$1") //有后缀
					else newOutputFileName += '_' + html_page_count;

					newFileStream = fs.createWriteStream(newOutputFileName);
					newFileStream.write(htmlHead + '\n');
					html_line_count = 0;
					
					console.log(newOutputFileName);
				}
			}
			break;
		}
		case 3:
		{
			if(line.startsWith("Content-Location"))
			{
				read_status = 4;
				currentImageName = line.slice(17);
				//skip_lines = 1;
			}
			break;
		}
		case 4:
		{
		/*
			if(skip_lines > 0)
			{
				skip_lines -= 1;
			}
		*/
			bufferImage += line;
			break;
		}
	}
});

fileStream.on('data', (chunk) => {
	curSize += chunk.length;
	var output = '总进度: ' + Math.floor(curSize / totalSize * 100) + '%; (' + process.uptime().toFixed(3) + 's)\r';
	if(processedImageCount) output = '图像输出数量: ' + processedImageCount + '; ' + output;
	process.stdout.write(output);
})

// 文件读取完毕
rl.on('close', () => {
  console.log('\n>> 处理完毕。');
});

// thanks to LLM. i dont want to use any other modules.
function decodeHtmlEntities(str) {
  const entityMap = {
    '&amp;': '&',
    '<': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&nbsp;': ' ',
    '&apos;': "'",
    '&cent;': '¢',
    '&pound;': '£',
    '&yen;': '¥',
    '&euro;': '€',
    '&copy;': '©',
    '&reg;': '®',
    '&deg;': '°',
    '&plusmn;': '±',
    '&micro;': 'µ',
    '&para;': '¶',
    '&middot;': '·',
    '&cedil;': '¸',
    '&sect;': '§',
    '&uml;': '¨',
    '&circ;': 'ˆ',
    '&tilde;': '˜',
    '&ensp;': ' ',
    '&emsp;': ' ',
    '&thinsp;': ' ',
    '&zwnj;': '‌',
    '&zwj;': '‍',
    '&lrm;': '‎',
    '&rlm;': '‏',
    '&ndash;': '–',
    '&mdash;': '—',
    '&lsquo;': '‘',
    '&rsquo;': '’',
    '&ldquo;': '“',
    '&rdquo;': '”',
    '&sbquo;': '‚',
    '&bdquo;': '„',
    '&dagger;': '†',
    '&Dagger;': '‡',
    '&permil;': '‰',
    '&lsaquo;': '‹',
    '&rsaquo;': '›',
    '&oline;': '‾',
    '&frasl;': '⁄',
    '&times;': '×',
    '&divide;': '÷',
    '&fnof;': 'ƒ',
    '&Alpha;': 'Α',
    '&Beta;': 'Β',
    '&Gamma;': 'Γ',
    '&Delta;': 'Δ',
    '&Epsilon;': 'Ε',
    '&Zeta;': 'Ζ',
    '&Eta;': 'Η',
    '&Theta;': 'Θ',
    '&Iota;': 'Ι',
    '&Kappa;': 'Κ',
    '&Lambda;': 'Λ',
    '&Mu;': 'Μ',
    '&Nu;': 'Ν',
    '&Xi;': 'Ξ',
    '&Omicron;': 'Ο',
    '&Pi;': 'Π',
    '&Rho;': 'Ρ',
    '&Sigma;': 'Σ',
    '&Tau;': 'Τ',
    '&Upsilon;': 'Υ',
    '&Phi;': 'Φ',
    '&Chi;': 'Χ',
    '&Psi;': 'Ψ',
    '&Omega;': 'Ω',
    '&alpha;': 'α',
    '&beta;': 'β',
    '&gamma;': 'γ',
    '&delta;': 'δ',
    '&epsilon;': 'ε',
    '&zeta;': 'ζ',
    '&eta;': 'η',
    '&theta;': 'θ',
    '&iota;': 'ι',
    '&kappa;': 'κ',
    '&lambda;': 'λ',
    '&mu;': 'μ',
    '&nu;': 'ν',
    '&xi;': 'ξ',
    '&omicron;': 'ο',
    '&pi;': 'π',
    '&rho;': 'ρ',
    '&sigmaf;': 'ς',
    '&sigma;': 'σ',
    '&tau;': 'τ',
    '&upsilon;': 'υ',
    '&phi;': 'φ',
    '&chi;': 'χ',
    '&psi;': 'ψ',
    '&omega;': 'ω',
    '&thetasym;': 'ϑ',
    '&upsih;': 'ϒ',
    '&piv;': 'ϖ',
    '&bull;': '•',
    '&hellip;': '…',
    '&prime;': '′',
    '&Prime;': '″',
    '&oline;': '‾',
    '&frasl;': '⁄',
    '&weierp;': '℘',
    '&image;': 'ℑ',
    '&real;': 'ℜ',
    '&trade;': '™',
    '&alefsym;': 'ℵ',
    '&larr;': '←',
    '&uarr;': '↑',
    '&rarr;': '→',
    '&darr;': '↓',
    '&harr;': '↔',
    '&crarr;': '↵',
    '&lceil;': '⌈',
    '&rceil;': '⌉',
    '&lfloor;': '⌊',
    '&rfloor;': '⌋',
    '&loz;': '◊',
    '&spades;': '♠',
    '&clubs;': '♣',
    '&hearts;': '♥',
    '&diams;': '♦',
    '&forall;': '∀',
    '&part;': '∂',
    '&exist;': '∃',
    '&empty;': '∅',
    '&nabla;': '∇',
    '&isin;': '∈',
    '&notin;': '∉',
    '&ni;': '∋',
    '&prod;': '∏',
    '&sum;': '∑',
    '&minus;': '−',
    '&lowast;': '∗',
    '&radic;': '√',
    '&prop;': '∝',
    '&infin;': '∞',
    '&ang;': '∠',
    '&and;': '∧',
    '&or;': '∨',
    '&cap;': '∩',
    '&cup;': '∪',
    '&int;': '∫',
    '&there4;': '∴',
    '&sim;': '∼',
    '&cong;': '≅',
    '&asymp;': '≈',
    '&ne;': '≠',
    '&equiv;': '≡',
    '&le;': '≤',
    '&ge;': '≥',
    '&sub;': '⊂',
    '&sup;': '⊃',
    '&nsub;': '⊄',
    '&sube;': '⊆',
    '&supe;': '⊇',
    '&oplus;': '⊕',
    '&otimes;': '⊗',
    '&perp;': '⊥',
    '&sdot;': '⋅',
    '&lceil;': '⌈',
    '&rceil;': '⌉',
    '&lfloor;': '⌊',
    '&rfloor;': '⌋',
    '&lang;': '〈',
    '&rang;': '〉',
    '&loz;': '◊',
    '&spades;': '♠',
    '&clubs;': '♣',
    '&hearts;': '♥',
    '&diams;': '♦'
  };

  const entityPattern = /&[a-zA-Z0-9#]+;/g;
  return str.replace(entityPattern, (match) => {
    return entityMap[match] || match;
  });
}