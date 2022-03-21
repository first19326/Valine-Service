'use strict';
const nodemailer = require('nodemailer');
const ejs = require('ejs');
const fs  = require('fs');
const path = require('path');

let config = {
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
}

if (process.env.SMTP_SERVICE != null) {
    config.service = process.env.SMTP_SERVICE;
} else {
    config.host = process.env.SMTP_HOST;
    config.port = parseInt(process.env.SMTP_PORT);
    config.secure = process.env.SMTP_SECURE === "false" ? false : true;
}

const transporter = nodemailer.createTransport(config);
let templateName = process.env.TEMPLATE_NAME ?  process.env.TEMPLATE_NAME : "default";
let noticeTemplate = ejs.compile(fs.readFileSync(path.resolve(process.cwd(), 'template', templateName, 'notice.ejs'), 'utf8'));
let sendTemplate = ejs.compile(fs.readFileSync(path.resolve(process.cwd(), 'template', templateName, 'send.ejs'), 'utf8'));

transporter.verify(function(error, success) {
    if (error) {
        console.log('SMTP 邮箱配置异常: ', error);
    }
    if (success) {
        console.log("SMTP 邮箱配置正常!");
    }
});

exports.notice = (comment) => {

    // Master自己发的评论不需要通知
    if (comment.get('mail') === process.env.RECEIVE_EMAIL || comment.get('mail') === process.env.SMTP_USER) {
        return;
    }

    let emailSubject = '叮咚！『' + process.env.SITE_NAME + '』上有新评论了';
    let emailContent =  noticeTemplate({
                        siteName: process.env.SITE_NAME,
                        siteUrl: process.env.SITE_URL,
                        name: comment.get('nick'),
                        text: comment.get('comment'),
                        url: comment.get('url')
                    });

    if (comment.get('isSpam')) {
        emailSubject = '[SPAM]' + emailSubject;
    }

    let mailOptions = {
        from: '"' + process.env.SENDER_NAME + '" <' + process.env.SMTP_USER + '>',
        to: process.env.RECEIVE_EMAIL || process.env.SMTP_USER,
        subject: emailSubject,
        html: emailContent
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            return console.log(error);
        }
        comment.set('isNotified', true);
        comment.save();
        console.log('Master通知邮件成功发送: %s', info.response);
    });
}

exports.send = (currentComment, parentComment)=> {

    let emailSubject = '叮咚！『' + process.env.SITE_NAME + '』上有人@了你';
    let emailContent = sendTemplate({
                            siteName: process.env.SITE_NAME,
                            siteUrl: process.env.SITE_URL,
                            pname: parentComment.get('nick'),
                            ptext: parentComment.get('comment'),
                            name: currentComment.get('nick'),
                            text: currentComment.get('comment'),
                            url: currentComment.get('url') + "#" + currentComment.get('pid')
                        });

    let mailOptions = {
        from: '"' + process.env.SENDER_NAME + '" <' + process.env.SMTP_USER + '>', // sender address
        to: parentComment.get('mail'),
        subject: emailSubject,
        html: emailContent
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            return console.log(error);
        }
        currentComment.set('isNotified', true);
        currentComment.save();
        console.log('AT通知邮件成功发送: %s', info.response);
    });
};
