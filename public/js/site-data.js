/* Highfield Assembly site content: built-in defaults.
   When the CMS (Firebase) is set up, sermons, events, gallery photos and leaders
   come from the database instead, and these are only used as a fallback. */
(function(){
  const WEEK = [
    {d:0, day:"Sunday",   time:"09:00 – 13:00", start:"09:00", name:"Main Service", note:"Praise, worship and the Word"},
    {d:0, day:"Sunday",   time:"10:00 – 11:00", start:"10:00", name:"Bible Study", note:"Part of the Sunday gathering"},
    {d:null, day:"Midweek", time:"In homes", start:null, name:"Cell Groups", note:"Ask an elder for the group near you"},
    {d:4, day:"Thursday", time:"Time TBC", start:null, name:"China Chemadzimai", note:"Women's meeting"},
    {d:6, day:"Saturday", time:"14:00 onwards", start:"14:00", name:"Youth Meeting", note:"For young people"}
  ];
  const PEOPLE = [
    {name:"Elder Dabga", role:"Church Secretary", phone:"0777535748"},
    {name:"Elder Mupingo Jnr", role:"Elder", phone:"0773986851"},
    {name:"Deacon Prosper", role:"Youth Leader", phone:"0784584001"}
  ];
  const SERMONS = [
    {title:"Example: Walking in the Spirit", speaker:"Guest speaker", series:"Life in the Spirit", scripture:"Galatians 5:16-25", date:"Example"},
    {title:"Example: The Great Commission", speaker:"Elder Dabga", series:"Make Him Known", scripture:"Matthew 28:18-20", date:"Example"},
    {title:"Example: Faith that Moves", speaker:"Elder Mupingo", series:"Faith", scripture:"Hebrews 11:1-6", date:"Example"}
  ];
  const EVENTS = [
    {name:"Example: Youth Conference", date:"2026-12-05", where:"Highfield Assembly", note:"Replace with a real event"},
    {name:"Example: Christmas Service", date:"2026-12-25", where:"Highfield Assembly", note:"Replace with a real event"}
  ];
  const MINISTRIES = [
    {name:"Men's Ministry", when:"Schedule TBC", text:"Fellowship, Bible study and brotherhood for the men of the church."},
    {name:"China Chemadzimai", when:"Thursdays · Women's meeting", text:"Prayer, teaching and sisterhood for the women of the church."},
    {name:"Youth Ministry", when:"Saturdays · 14:00", text:"Worship, teaching and friendship for young people. Led by Deacon Prosper, our Youth Leader."},
    {name:"Children's Ministry", when:"Sundays", text:"Helping children learn about Jesus in a way they enjoy."},
    {name:"Cell Groups", when:"Midweek · in homes", text:"Small groups that meet in homes to pray, study and care for each other."},
    {name:"Community Outreach", when:"Schedule TBC", text:"Reaching and serving our neighbours in Highfield."}
  ];

  const ICONS = {
    usher:'<path d="M12 4a3 3 0 1 1 0 6 3 3 0 0 1 0-6z"/><path d="M6 20v-3a6 6 0 0 1 12 0v3"/><path d="M15 13l4-3M9 13l-4-3"/>',
    media:'<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3z"/>',
    music:'<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
    mic:'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    cup:'<path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M17 11h1.5a2.5 2.5 0 0 1 0 5H17M8 3v3M12 3v3"/>',
    shield:'<path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6z"/><path d="m9 12 2 2 4-4"/>'
  };
  const DEPTS = [
    {name:"Ushering", sub:"Department", icon:"usher"},
    {name:"Media", sub:"Department", icon:"media"},
    {name:"Praise & Worship", sub:"Worship Team", icon:"music", photo:"images/praise-team.jpg"},
    {name:"Service Directors", sub:"MCs", icon:"mic"},
    {name:"Hospitality", sub:"Hosting", icon:"cup"},
    {name:"Protocol", sub:"Order & Security", icon:"shield"}
  ];
  const PHOTOS = [
    {src:"images/worship.jpg", cap:"Worship during the Sunday service", wide:true, category:"Services"},
    {src:"images/youth-outside.jpg", cap:"Our young people after church", category:"Youth"},
    {src:"images/youth-service.jpg", cap:"Youth service: the youth leading praise", wide:true, category:"Youth"},
    {src:"images/youth-group.jpg", cap:"Highfield Assembly youth in their matching T-shirts", wide:true, category:"Youth"},
    {src:"images/fellowship-1.jpg", cap:"Fellowship after church", wide:true, category:"Fellowship"},
    {src:"images/fellowship-2.jpg", cap:"Fellowship after church", category:"Fellowship"},
    {src:"images/fellowship-3.jpg", cap:"Smiles and fellowship after the service", category:"Fellowship"},
    {src:"images/congregation.jpg", cap:"The congregation gathered on Sunday", category:"Services"},
    {src:"images/praise-team.jpg", cap:"Ladies leading praise", category:"Ministries"},
    {src:"images/sunday-service.jpg", cap:"Listening to the Word", wide:true, category:"Services"},
    {src:"images/congregation-2.jpg", cap:"Sunday service", category:"Services"},
    {src:"images/youth-girls.jpg", cap:"Youth fellowship", category:"Youth"},
    {src:"images/leadership.jpg", cap:"Our leadership", wide:true, category:"Leadership"},
    {src:"images/join-us.jpg", cap:"What's stopping you from joining us?", category:"Youth"},
    {src:"images/history-1.jpg", cap:"From our early years", category:"History"},
    {src:"images/history-2.jpg", cap:"The church family in the early days", wide:true, category:"History"},
    {src:"images/outdoor-service.jpg", cap:"Members gathered for an outdoor service", wide:true, category:"Services"},
    {src:"images/leaders-front-row.jpg", cap:"Apostle & Amai Mufema with Pastor & Amai Magumise in the front row", category:"Leadership"}
  ];

  const SENIOR = [
    {name:"Pastor O & Amai Magumise", role:"Senior Pastors", photo:"images/leaders/magumise.jpg"},
    {name:"Apostle J & Amai Mufema", role:"Apostle", photo:"images/leaders/mufema.jpg"},
    {name:"Apostle Q Lekuku", role:"Apostle"}
  ];
  const ELDERS_DEACONS = [
    {name:"Elder Chataika", role:"Elder"},
    {name:"Elder Dabga", role:"Elder · Church Secretary"},
    {name:"Elder Muchenje", role:"Elder"},
    {name:"Elder Mupingo Jnr", role:"Elder"},
    {name:"Elder Mrs Madya", role:"Elder", photo:"images/leaders/madya.jpg"},
    {name:"Elder Mrs Chataika", role:"Elder", photo:"images/leaders/chataika-mrs.jpg"},
    {name:"Elderess Dabga", role:"Elderess"},
    {name:"Elderess Muchenje", role:"Elderess"},
    {name:"Deacon Mupingo Snr", role:"Deacon"},
    {name:"Deaconess Mupingo Snr", role:"Deaconess"},
    {name:"Deacon Prosper", role:"Deacon · Youth Leader", photo:"images/leaders/prosper.jpg"},
    {name:"Deaconess Mellisa", role:"Deaconess"},
    {name:"Deacon Chinyemba", role:"Deacon"},
    {name:"Deacon Kahanana", role:"Deacon"},
    {name:"Deaconess Kahanana", role:"Deaconess"}
  ];

  window.HF_DEFAULTS = { WEEK, PEOPLE, SERMONS, EVENTS, MINISTRIES, ICONS, DEPTS, PHOTOS, SENIOR, ELDERS_DEACONS };
})();
