/* MEMO
	BackGround(Event) Page = 後ろで動いているページ（権限強い、DOMアクセス不可）
	ContentScripts = 指定したドメインで読み込まれる追加JS（権限弱い、DOMアクセス可）
	BrowserAction = タスクバーから実行されるポップアップ（権限普通、DOMアクセス不可）
	http://www.apps-gcp.com/calendar-extension/
*/

/**
 * 日付をフォーマットする
 * @param  {Date}   date     日付
 * @param  {String} [format] フォーマット
 * @return {String}          フォーマット済み日付
 * http://qiita.com/osakanafish/items/c64fe8a34e7221e811d0
 */
var formatDate = function (date, format) {
	if (!format) format = 'YYYY-MM-DD hh:mm:ss.SSS';
	format = format.replace(/YYYY/g, date.getFullYear());
	format = format.replace(/MM/g, ('0' + (date.getMonth() + 1)).slice(-2));
	format = format.replace(/DD/g, ('0' + date.getDate()).slice(-2));
	format = format.replace(/hh/g, ('0' + date.getHours()).slice(-2));
	format = format.replace(/mm/g, ('0' + date.getMinutes()).slice(-2));
	format = format.replace(/ss/g, ('0' + date.getSeconds()).slice(-2));
	if (format.match(/S/g)) {
		var milliSeconds = ('00' + date.getMilliseconds()).slice(-3);
		var length = format.match(/S/g).length;
		for (var i = 0; i < length; i++) format = format.replace(/S/, milliSeconds.substring(i, i + 1));
	}
	return format;
};

var google = new OAuth2('google', {
	client_id: '339913519683-t9090pt4hq9oqi1oqr5t8n9lci45jovh.apps.googleusercontent.com',
	client_secret: 'PCro6F8V94xLpyLDGy7QNPpM',
	api_scope: 'https://www.googleapis.com/auth/calendar'
});

$(document).ready(function(){
	$(".js-storage").each(function() {
		var name = $(this).attr("name");

		if ( localStorage.getItem(name) ) {
			$(this).val( localStorage.getItem(name).split(",") );
		}
	});

	$(".js-storage").blur(function() {
		var name = $(this).attr("name");

		localStorage.setItem(name, $(this).val());
	});

	//カレンダーリストの取得
	google.authorize(function() {
		$.ajax({
			type: "GET",
			url: "https://www.googleapis.com/calendar/v3/users/me/calendarList",
			dataType: "json",
			headers: {
				'Authorization': 'Bearer ' + google.getAccessToken()
			}
		})
		.done(function(data, statusText, jqXHR) {
			console.log(data);
			var list = data.items;

			for (var i = 0; i < list.length; i++) {
				//resource.calendarとgroup.v.calendarは除外
				if ( list[i].id.indexOf("resource.calendar") == -1 && list[i].id.indexOf("group.v.calendar") == -1 ) {
					$("#ids").append($('<option>').html(list[i].summary).val(list[i].id));
				}
			}

			// 前回選択したものを復元する
			if ( localStorage.getItem("ids") ) {
				$("#ids").val( localStorage.getItem("ids").split(",") );
			}

			$("#check").text("OAuth認証済みです。");
		})
		.fail(function(jqXHR, statusText, errorThrown) {
			if (jqXHR.status === 401) {
				chrome.identity.removeCachedAuthToken({
					'token': access_token
				},
				function () {
					alert("無効なアクセストークンを削除しました。再度認証を実施してください。");
				});
			} else {
				var data = JSON.parse(xhr.responseText);
				alert("カレンダーリストの取得に失敗しました。リロードしてください");
			}
		});
	});

	// 日付の初期値を設定
	$("#date").val(formatDate( new Date, "YYYY-MM-DD"));
	$("#date2").val(formatDate( new Date, "YYYY-MM-DD"));

	// イベントを取得→テキストに変換
	$("#convert").click(function() {
		var date = $("#date").val();
		var date2 = $("#date2").val();
		var calendarIds = $("#ids").val();
		var query = $("#query").val();
		var eventList = [];

		google.authorize(function() {
			var timeMin = encodeURIComponent(formatDate( new Date(date), "YYYY-MM-DDT00:00:00.000+09:00"));
			var timeMax = encodeURIComponent(formatDate( new Date(date2), "YYYY-MM-DDT23:59:59.000+09:00"));

			$("#buff").text("");

			for ( var calnum = 0; calnum < calendarIds.length; calnum++ ) {
				$.ajax({
					type: "GET",
					// url: "https://www.googleapis.com/calendar/v3/calendars/" + calendarIds[calnum] + "/events?singleEvents=true&orderBy=startTime&timeMin=" + timeMin + "&timeMax=" + timeMax + "&timeZone=Asia/Tokyo" + "&q=" + query,
					url: "https://www.googleapis.com/calendar/v3/calendars/" + calendarIds[calnum] + "/events?singleEvents=true&orderBy=startTime&timeMin=" + timeMin + "&timeMax=" + timeMax + "&timeZone=Asia/Tokyo",
					dataType: "json",
					headers: {
						'Authorization': 'Bearer ' + google.getAccessToken()
					},
					success: function(data) {
						var items = data.items;
						var stash = "";

						for ( var i=0; i < items.length; i++ ) {
							var item = items[i];

							if ( new Date(item.start.dateTime).toString() === "Invalid Date" ) {
								continue;
							}

							if ( item.summary.indexOf(query) == -1 ) {
								continue;
							}

							stash += formatDate( new Date(item.start.dateTime), 'YYYY/MM/DD') + "\t" + formatDate( new Date(item.start.dateTime), 'hh:mm') + "～" + formatDate( new Date(item.end.dateTime), 'hh:mm') + "\t" + data.summary + "\t" + item.summary + "\n";
						}

						$("#buff").text( $("#buff").text() + stash);
						$("#buff").text( $("#buff").text().replace(/\n\n/gm,"\n") );
					}
				});
			}
		});
	});
});