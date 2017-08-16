var express = require('express');
var router = express.Router();
var jsLib = require("../models/user");
var mongoose = require("mongoose");
var userSchema = new mongoose.Schema({
    name: { type: String, index: { unique: true, dropDups: true }}
});
var request = require("request-promise");
var cheerio = require("cheerio");
var schedule = require("node-schedule");
var url = "http://www.alexa.cn/siterank/";
var keyword = 100;
var pages = [1,2,3,4,5,6];
var frequentjs = ['jquery','jQuery','base','vue','common','bootstrap','main','vendor','seallogo','home','m','k','c','nav','voice','g','log','dc','taspeed','footer','modernizr','json','sea','lang','request','class','app','mobile','lib','ajax'];

mongoose.Promise = global.Promise;  
mongoose.connect('mongodb://localhost:27017/jslib');
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

var rule = new schedule.RecurrenceRule();
rule.minute = 6;
schedule.scheduleJob(rule,async function(){
	await jsLib.remove({});
	for(let i=0;i<frequentjs.length;i++){
		const jslib = new jsLib({
			name : frequentjs[i],
			num  : 0
		});
		const firstSave = await jslib.save();
	}
	for(let j=0;j<pages.length;j++){
		var options = {
			url: url+'/'+pages[j],
			headers :{
				"Accept":"text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
				"User-Agent":"Mozilla/5.0 (Windows NT 6.3; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3018.3"}		
		}
		const response = await request(options);
		const answer = filterInfo(response);
		for(let k=0;k<answer.length;k++){
			var li_url = answer[k].li_url;
			var li_index = answer[k].li_index;
			var li_value = answer[k].li_value;
			if(Number(li_index)<=Number(keyword)){
				console.log(li_index+"-→"+li_value+"-→"+li_url);
				var options = {
					url: li_url,
					headers :{
						"User-Agent":"Mozilla/5.0 (Windows NT 6.3; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3018.3"}		
				};
			try{	
				const jsReq = await request(options);
				const scriptsArr = filterJs(jsReq);
				if(scriptsArr!='') {
					for(let t=0;t<scriptsArr.length;t++){
						await jsLib.update({name:scriptsArr[t]},{'$inc':{'num':1}},{upsert:true});    
					}
				}
			}catch(e){
				console.log("error...");
			}
			
			}	
		}
	}
})

//计算页面个数
router.post('/pagenum',function(req,res){
		 jsLib.find({},function(err,data){
				var n = data.length;
				var pages = n/10;
				res.json(pages);
			})
})
//搜索数据
router.post('/searchUrl',function(req,res){
	var urlArr = [];
	jsLib.find({}).sort({"num":-1}).exec(function(err,data){
				data.forEach(function(value,index){
					if(value.name==req.body.searchUrl){
						console.log(req.body.searchUrl)
						var urlObj = {	
							rank:index+1,
							name:value.name,
							num :value.num
						};
					urlArr.push(urlObj);
					}
				})
			res.json(urlArr);
	})		
})
//返回响应页面的数据
router.post('/searchLibjs', async function(req,res){
	var page = req.body.page;
			await jsLib.find({}).sort({"num":-1}).limit(10).skip((page-1)*10).exec(function(err,data){
				if(err) console.log(err);
				res.json(data);
			})			
})


function filterInfo(html){
	var $ = cheerio.load(html);
	var lis = $('.siterank-sitelist>li');
	var target_info = [];
	
	lis.each(function(index,value){
		var elem = $(value);
		var li_index = elem.find('.rank-index').text(),
			li_value = elem.find('.domain>a').text(),
			li_url = "http://www."+li_value.toLowerCase();
		var elem_info = {
			li_index : li_index,
			li_value :li_value,
			li_url : li_url
		}
		target_info.push(elem_info);
	})
	return target_info;
}

//过滤出网站的js库
function filterJs(result){
	var scriptsArr =[];				
	if(result){
		var $ = cheerio.load(result);		
		var scripts = $("script").toArray();
		scripts.forEach(function(value,index){
			var value = $(value);
			if(value.attr('src')){	
				var reg = /[^\/\\]+$/gi;
				var libName = value.attr('src').match(reg).join('');
			    var srcObj = libName.slice(0,libName.indexOf('.'));
			    var reg2 = /^[a-zA-Z]+$/gi;
			    var srcObj2 = srcObj.match(reg2);
			    if(srcObj2!=null){
			      	scriptsArr.push(srcObj2[0].trim());	
			    }
			}
		})
		return scriptsArr;
	}
}

module.exports = router;
