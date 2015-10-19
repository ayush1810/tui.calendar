/**
 * @fileoverview 캘린더 생성/수정 폼 컴포넌트
 * @author NHN Ent. FE Development Team <dl_javascript@nhnent.com>
 */
'use strict';

var util = global.ne.util;
var domutil = require('../../../common/domutil');
var domevent = require('../../../common/domevent');
var View = require('../../../view/view');
var API = require('../../controller/api');
var tmpl = require('./calendar.hbs');
var noop = function() {};

// 캘린더 유형 셀렉트박스 리스트
var CALENDAR_TYPE_LIST = [{
    value: 'private',
    label: '개인 캘린더'
}, {
    value: 'shared',
    label: '공유 캘린더'
}];

// 개인 캘린더 공유 시 사용자 권한 리스트
var PRIVATE_LIST = [{
    value: 'opaque_view',
    label: '단순 조회'
}, {
    value: 'view',
    label: '조회'
}, {
    value: 'read_write',
    label: '위임'
}];

// 공유 캘린더 공유 시 사용자 권한 리스트
var SHARE_LIST = [{
    value: 'view',
    label: '조회'
}, {
    value: 'read_write',
    label: '수정/삭제'
}, {
    value: 'all',
    label: '모든권한'
}];

// 라디오박스 리스트 프리셋
var COLOR_LIST = [{
    value: 'ed2327',
    label: 'ed2327'
}, {
    value: 'ee5307',
    label: 'ee5307'
}, {
    value: 'f4c30a',
    label: 'f4c30a'
}, {
    value: '55d72b',
    label: '55d72b'
}, {
    value: '3d9af6',
    label: '3d9af6'
}, {
    value: 'be55da',
    label: 'be55da'
}, {
    value: '946651',
    label: '946651'
}];

/**
 * @constructor
 * @extends {View}
 * @param {object} options - options
 *  @param {object} [options.member] - 로그인 사용자 정보
 *  @param {string} [options.projectCode] - project code for creation
 *  @param {boolean} [options.isCreateMode=true] - mode. set true then `creation`, false then `modify`
 *  @param {boolean} [options.isPrivate] - 개인 캘린더 여부
 *  @param {string} [options.method=POST] - http method
 *  @param {string} [options.action] - url
 *  @param {object} [options.formData] - 미리 채워 둘 폼 데이터 (없어도 무방)
 *  @param {function} [afterRender] - 렌더 완료 후 콜백. 첫 번째 인자는 프로젝트 입력 영역 두 번째 인자는 공유설명 영역
 *  @param {function} [beforeSubmit] - 폼 서브밋 전 이벤트 첫 번째 인자는 서버로 보낼 데이터. 조작 가능
 * @param {HTMLElenent} container - container element
 */
function CalendarForm(options, container) {
    options = options || {};
    container = domutil.appendHTMLElement(
        'div', container, 'schedule-view-calendar-form');

    View.call(this, options, container);

    /**
     * @type {API}
     */
    this.api = new API({
        member: options.member
    });

    /**
     * @type {object}
     */
    this.options = util.extend({
        projectCode: '*',
        isCreateMode: true,
        method: 'POST',
        action: '/wapi/task-tracker/projects/{{projectCode}}/calendars',
        
        calendarList: CALENDAR_TYPE_LIST,
        privateList : PRIVATE_LIST,
        shareList: SHARE_LIST,
        colorList: COLOR_LIST,

        afterRender: noop,
        beforeSubmit: noop,

        formData: {
            type: 'private'
        } 
    }, options);

    domevent.on(container, {
        'submit': this._onSubmit,
        'change': this._onChange,
        'click': this._onClick
    }, this);

    this.render();
}

util.inherit(CalendarForm, View);

/**
 * @override
 */
CalendarForm.prototype._beforeDestroy = function() {
    domevent.off(this.container, {
        'submit': this._onSubmit,
        'change': this._onChange,
        'click': this._onClick
    }, this);

    this.api = this.options = null;
};

/**
 * 캘린더 폼으로부터 객체 형태의 데이터를 추출함
 * @returns {object} 폼 데이터
 */
CalendarForm.prototype.getFormData = function() {
    var formData = domutil.getFormData(domutil.find('form', this.container)),
        userId = formData['userId[]'] || [],
        authority = formData['authority[]'] || [],
        result = {
            projectName: formData.projectName,
            projectCode: formData.projectCode,
            name: formData.name,
            color: formData.color,
            colorHex: formData.colorHex,
            type: formData.type,
            share: []
        };

    userId = util.isArray(userId) ? userId : [userId];
    authority = util.isArray(authority) ? authority : [authority];

    util.forEach(userId, function(id, index) {
        result.share.push({
            id: id,
            authority: authority[index]
        });
    });

    return result;
};

/**
 * @override
 * @param {object} [formData] - 폼 데이터를 넘기면 렌더링 시 적용한다
 */
CalendarForm.prototype.render = function(formData) {
    var options = this.options,
        container = this.container,
        projectInput,
        shareInput;

    if (formData) {
        options.formData = formData;
    }

    container.innerHTML = tmpl(options);

    projectInput = domutil.find('.schedule-view-calendar-form-project', container);
    shareInput = domutil.find('.schedule-view-calendar-form-share', container);

    if (projectInput && shareInput) {
        options.afterRender(projectInput, shareInput);
    }
};

/**
 * 캘린더 유형 변경 시 핸들러
 * @param {Event} e - 캘린더 유형 셀렉트박스 변경 이벤트 객체
 */
CalendarForm.prototype._onChange = function(e) {
    var that = this,
        target = e.target,
        newAction,
        form;

    if (target.name === 'type') {
        this.render(this.getFormData());

        util.debounce(function() {
            var select = domutil.find('select', that.container);
            if (select) {
                select.focus();
            }
        }, 0)();
    }

    // 프로젝트 코드 변경 시 처리
    if (target.name === 'projectName') {
        form = domutil.find('form', that.container);
        if (form) {
            //TODO: 프로젝트 코드 받아와야 함
            newAction = that.options.action.replace('{{projectCode}}', window.encodeURIComponent(target.value));
            form.setAttribute('action', newAction);
        }
    }
};

/**
 * 공유설정 추가 버튼 클릭 핸들러
 * @param {Event} e - 버튼 클릭 이벤트
 */
CalendarForm.prototype._onClick = function(e) {
    var that = this,
        formData;

    if (e.target.type === 'button') {
        formData = that.getFormData();
        formData.share.push({id: '', authority: ''});
        that.render(formData);

        util.debounce(function() {
            domutil.find('input', that.container, function(el) {
                return el.name === 'userId[]';
            }).pop().focus();
        }, 0)();
    }
};

/**
 * 생성/수정 버튼 클릭 시 핸들러
 * @param {Event} e - 전송 이벤트 객체
 */
CalendarForm.prototype._onSubmit = function(e) {
    var formData;
    domevent.stop(e);

    formData = this.getFormData();

    this.options.beforeSubmit(formData);

    //TODO: submit data to API server.
    console.log(formData);
};

module.exports = CalendarForm;

