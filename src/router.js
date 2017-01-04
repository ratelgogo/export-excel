const route = require('koa-route');
const xlsx = require('node-xlsx');
const co = require('co');
const fetch = require('node-fetch');
const uuidV4 = require('uuid/v4');

const API = 'http://api.yiweimatou.com:4001';

function queryString(params) {
    return Object.keys(params).map(i => `${i}=${encodeURIComponent(params[i])}`).join('&');
}

function timeFormat(timeStamp) {
    const date = new Date(timeStamp);
    let minutes = date.getMinutes();
    if (minutes < 10) {
        minutes = '0' + minutes;
    }
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()} ${date.getHours()}:${minutes}`
}

function score(right, total) {
    if (right == 0 || total == 0) return 0;
    return Math.round(right / total * 100);
}

function errorHandler(error, ctx) {
    console.log('api error: ', error);
    ctx.body = {
        code: 500
    }
}

const handler = co.wrap(function *(ctx) {
    const query = ctx.request.query;
    if (!query.id) {
        return ctx.body = {
            code: 400,
            msg: '缺少参数id'
        }
    }
    if (!query.tid) {
        return ctx.body = {
            code: 400,
            msg: '缺少参数tid'
        }
    }
    const params = {
        section_id: query.id,
        limit: 10000,
        offset: 1
    };
    const data = yield fetch(`${API}/paper/list?${queryString(params)}`)
        .then(data => data.json())
        .then(json => json.list)
        .catch(error => errorHandler(error, ctx));
    const users = yield fetch(`${API}/account/list?${queryString({
        offset: 1, limit: 1000, id_list: data.map(v => v.account_id).join() })}`)
        .then(res => res.json())
        .then(json => json.list)
        .catch(error => errorHandler(error, ctx));
    const result = data.map(v => {
        const user = users.find(i => i.id === v.account_id);
        if (user) {
            return [
                user.id_code,
                user.cet_name || user.cname,
                score(v.right_num, v.answer_num),
                timeFormat(v.add_ms * 1000)
            ]
        }
        return [ '', '', score(v.right_num, v.total), timeFormat(v.add_ms * 1000)]
    });
    const topicIds = yield fetch(`${API}/topics/get?id=${query.tid}`)
        .then(res => res.json())
        .then(json => json.get.topic_id_list)
        .catch(error => errorHandler(error, ctx));
    const topics = yield fetch(`${API}/topic/list?limit=10000&offset=1&id_list=${encodeURIComponent(topicIds)}`)
        .then(res => res.json())
        .then(json => json.list)
        .catch(error => errorHandler(error, ctx));
    const cal = topics.map(v => {
        let total = 0, rightTotal = 0, a =0 , b = 0, c = 0, d = 0, e = 0;
        data.forEach(item => {
            const idx = item.topic_id_list.split(',').indexOf(v.id.toString());
           if (idx > -1) {
               total ++;
               const answer = item.topic_answer_list.split(',')[idx];
               if (answer === v.answer.toString()) {
                   rightTotal ++;
               }
               switch (answer) {
                   case 'A':
                       a ++;
                       break;
                   case 'B':
                       b ++;
                       break;
                   case 'C':
                       c ++;
                       break;
                   case 'D':
                       d ++;
                       break;
                   case 'E':
                       e ++;
                       break;
                   default:
                       break;
               }
           }
        });
        return [
            v.id, v.question, total, rightTotal, total - rightTotal, score(rightTotal, total),
            v.option1, v.option2, v.option3, v.option4, v.option5,
            a, b, c, d, e
        ]
    });
    const buffer = xlsx.build([
        { name: '成绩', data:
            [
                ['课程:', query.lesson],
                ['试卷标题:', query.title],
                ['发布时间:', query.p_time],
                ['统计时间:', query.c_time],
                ['测试人数:', query.num],
                ['个人识别码', '姓名', '成绩', '交题时间'],
                ...result
            ]
        },
        {
            name: '成绩分析', data:
            [
                ['试题序号', '试题名称', '答题人数', '答对人数', '答错人数', '正确率(%)',
                    'A（选题内容）', 'B（选题内容）', 'C（选题内容）', 'D（选题内容）', 'E（选题内容）',
                    'A(人数)', 'B(人数)', 'C(人数)', 'D(人数)', 'E(人数)'],
                ...cal
            ]
        }
    ]);
    ctx.set('Content-disposition', `attachment; filename=${uuidV4()}.xlsx`);
    ctx.set('Content-type', 'application/xlsx');
    ctx.body = buffer;
});

module.exports = route.get('/excel', handler);